/**
 * 메모 관련 API 서비스
 * 오늘의 흐름, 메모 작성/수정/삭제 등의 API 호출 함수 제공
 * 오프라인 지원: 로컬 저장 및 자동 동기화 기능 통합
 */

import { apiClient } from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';
import { offlineMemoService } from './offline-memo-service.js';
import { networkMonitor } from '../utils/network-monitor.js';
import { MemoOperationHelper } from '../utils/memo-operation-helper.js';
import { syncStateManager } from '../utils/sync-state-manager.js';
import { requestQueueManager } from '../utils/request-queue-manager.js';
import { getTodayDateString } from '../utils/date-formatter.js';

export const memoService = {
  /**
   * 오늘의 흐름 조회 (서버 우선 전략)
   * - 온라인: 서버에서만 조회, IndexedDB는 캐시로만 사용 (오프라인 대비)
   * - 오프라인: IndexedDB에서만 조회
   * @param {Object} [params] - 조회 파라미터
   * @param {string} [params.date] - 조회할 날짜 (ISO 8601 형식: YYYY-MM-DD, 기본값: 오늘)
   * @param {string} [params.sortBy] - 정렬 방식 (SESSION, BOOK, TAG, 기본값: SESSION)
   * @param {string} [params.tagCategory] - 태그 대분류 (TYPE, TOPIC, 기본값: TYPE)
   * @returns {Promise<Object>} TodayFlowResponse
   */
  async getTodayFlow({ date, sortBy = 'SESSION', tagCategory } = {}) {
    // 온라인 상태면 서버에서만 조회 (IndexedDB 읽기 안 함)
    if (networkMonitor.isOnline) {
      // 동기화 중이면 대기
      if (syncStateManager.isSyncing) {
        console.log('[MemoService] 동기화 중이므로 대기...');
        const isSyncComplete = await syncStateManager.waitForSyncComplete();
        if (!isSyncComplete) {
          console.warn('[MemoService] 동기화 완료 대기 타임아웃, 서버 조회 시도');
        }
      }

      try {
        const params = {};
        if (date) params.date = date;
        if (sortBy) params.sortBy = sortBy;
        if (tagCategory) params.tagCategory = tagCategory;
        
        // 서버에서 조회
        const serverResponse = await apiClient.get(API_ENDPOINTS.MEMOS.TODAY_FLOW, params);

        // 서버 메모를 IndexedDB에 캐시로 저장 (오프라인 대비)
        // 비동기로 처리하여 응답 지연 방지
        Promise.all([
          ...(serverResponse.memosByBook ? Object.values(serverResponse.memosByBook).flatMap(bookGroup => 
            (bookGroup.memos || []).map(memo => 
              MemoOperationHelper.saveServerMemoAsLocal(memo).catch(err => 
                console.warn('[MemoService] IndexedDB 캐시 저장 실패 (무시):', err)
              )
            )
          ) : []),
          ...(serverResponse.memosByTag ? Object.values(serverResponse.memosByTag).flatMap(tagGroup => 
            (tagGroup.memos || []).map(memo => 
              MemoOperationHelper.saveServerMemoAsLocal(memo).catch(err => 
                console.warn('[MemoService] IndexedDB 캐시 저장 실패 (무시):', err)
              )
            )
          ) : [])
        ]).catch(() => {}); // 모든 실패 무시

        // 서버 데이터만 반환 (IndexedDB 읽기 안 함)
        return serverResponse;
      } catch (error) {
        console.error('서버 오늘의 흐름 조회 실패, IndexedDB 폴백 시도:', error);
        
        // 서버 실패 시에만 IndexedDB에서 조회 (오프라인 폴백)
        try {
          const localMemos = await this.getLocalMemosByDate(date);
          return this.mapLocalMemosToTodayFlowResponse(localMemos, sortBy, tagCategory);
        } catch (localError) {
          console.error('IndexedDB 조회도 실패:', localError);
          throw error; // 원래 에러를 다시 던짐
        }
      }
    } else {
      // 오프라인 상태면 IndexedDB에서만 조회
      const localMemos = await this.getLocalMemosByDate(date);
      return this.mapLocalMemosToTodayFlowResponse(localMemos, sortBy, tagCategory);
    }
  },

  /**
   * 메모 작성 날짜 목록 조회 (캘린더용)
   * @param {number} year - 조회할 년도
   * @param {number} month - 조회할 월 (1-12)
   * @returns {Promise<Array<string>>} 날짜 문자열 리스트 (ISO 8601 형식: YYYY-MM-DD)
   */
  async getMemoDates(year, month) {
    const params = { year, month };
    const response = await apiClient.get(API_ENDPOINTS.MEMOS.DATES, params);
    return response; // List<String> 반환
  },

  /**
   * 메모 작성 (하이브리드 전략: 네트워크 상태 기반 분기)
   * - 온라인: 서버 우선 처리 후 IndexedDB 갱신
   * - 오프라인: 로컬 우선 처리 (Offline-First)
   * - 동기화 중: 요청 큐잉 (질문 6-1 개선)
   * @param {Object} memoData - 메모 작성 데이터
   * @param {number} memoData.userBookId - 사용자 책 ID
   * @param {number} [memoData.pageNumber] - 페이지 번호
   * @param {string} memoData.content - 메모 내용
   * @param {Array<string>} [memoData.tags] - 태그 코드 리스트
   * @param {string} [memoData.memoStartTime] - 메모 시작 시간 (ISO 8601 형식, 기본값: 현재 시간)
   * @returns {Promise<Object>} MemoResponse
   */
  async createMemo(memoData) {
    if (networkMonitor.isOnline) {
      // 동기화 중이면 요청 큐에 추가 (질문 6-1 개선)
      if (syncStateManager.isSyncing) {
        console.log('[MemoService] 동기화 중이므로 요청 큐에 추가: createMemo');
        return await requestQueueManager.enqueue(
          () => this.createMemo(memoData),
          { type: 'create', data: memoData }
        );
      }

      // 온라인: 서버 우선 전략
      try {
        // 1. 서버에서 먼저 생성 시도
        const serverMemo = await apiClient.post(API_ENDPOINTS.MEMOS.CREATE, memoData);
        
        // 2. 성공 시 IndexedDB 갱신
        const localMemo = await MemoOperationHelper.updateLocalAfterCreate(serverMemo);
        
        // 3. 서버 메모 반환 (로컬 메모가 삭제된 경우 null이므로 서버 메모 반환)
        return localMemo ? this.mapLocalMemoToResponse(localMemo) : serverMemo;
      } catch (error) {
        // 서버 실패 시 오프라인 모드로 전환
        return await MemoOperationHelper.handleServerError(
          error,
          null,
          async () => {
            // 오프라인 로직: 로컬 저장소에 먼저 저장
            const localMemo = await offlineMemoService.createMemo(memoData);
            return this.mapLocalMemoToResponse(localMemo);
          }
        );
      }
    } else {
      // 오프라인: 로컬 우선 전략 (기존 로직)
      const localMemo = await offlineMemoService.createMemo(memoData);
      return this.mapLocalMemoToResponse(localMemo);
    }
  },

  /**
   * 메모 수정 (하이브리드 전략: 네트워크 상태 기반 분기)
   * - 온라인: 서버 우선 처리 후 IndexedDB 갱신
   * - 오프라인: 로컬 우선 처리 (Offline-First)
   * - 동기화 중: 요청 큐잉 (질문 6-1 개선)
   * @param {string|number} memoId - 메모 ID (localId 또는 serverId)
   * @param {Object} memoData - 메모 수정 데이터
   * @param {string} [memoData.content] - 메모 내용
   * @param {Array<string>} [memoData.tags] - 태그 코드 리스트
   * @param {number} [memoData.pageNumber] - 페이지 번호
   * @param {string} [memoData.memoStartTime] - 메모 시작 시간
   * @returns {Promise<Object>} MemoResponse
   */
  async updateMemo(memoId, memoData) {
    if (networkMonitor.isOnline) {
      // 동기화 중이면 요청 큐에 추가 (질문 6-1 개선)
      if (syncStateManager.isSyncing) {
        console.log('[MemoService] 동기화 중이므로 요청 큐에 추가: updateMemo');
        return await requestQueueManager.enqueue(
          () => this.updateMemo(memoId, memoData),
          { type: 'update', memoId, data: memoData }
        );
      }

      // 온라인: 서버 우선 전략
      try {
        // 1. 로컬 메모 조회 (serverId 확인용)
        const localMemo = await MemoOperationHelper.getLocalMemo(memoId);
        
        if (!localMemo) {
          // 로컬에 없으면 서버에서 조회 시도
          try {
            const serverMemo = await apiClient.get(API_ENDPOINTS.MEMOS.GET(memoId));
            // 서버에 존재하면 수정 시도
            const updatedServerMemo = await apiClient.put(
              API_ENDPOINTS.MEMOS.UPDATE(memoId),
              memoData
            );
            // IndexedDB 갱신
            await MemoOperationHelper.updateLocalAfterUpdate(memoId, updatedServerMemo);
            return updatedServerMemo;
          } catch (error) {
            throw new Error('메모를 찾을 수 없습니다.');
          }
        }

        // 2. serverId가 있으면 서버에서 수정 시도
        if (localMemo.serverId) {
          const updatedServerMemo = await apiClient.put(
            API_ENDPOINTS.MEMOS.UPDATE(localMemo.serverId),
            memoData
          );
          
          // 3. 성공 시 IndexedDB 갱신
          const updatedLocalMemo = await MemoOperationHelper.updateLocalAfterUpdate(
            localMemo.serverId,
            updatedServerMemo
          );
          
          return updatedLocalMemo 
            ? this.mapLocalMemoToResponse(updatedLocalMemo)
            : updatedServerMemo;
        } else {
          // serverId가 없으면 오프라인 로직으로 전환
          return await offlineMemoService.updateMemo(memoId, memoData)
            .then(localMemo => this.mapLocalMemoToResponse(localMemo));
        }
      } catch (error) {
        // 서버 실패 시 오프라인 모드로 전환
        return await MemoOperationHelper.handleServerError(
          error,
          memoId,
          async () => {
            const localMemo = await offlineMemoService.updateMemo(memoId, memoData);
            return this.mapLocalMemoToResponse(localMemo);
          }
        );
      }
    } else {
      // 오프라인: 로컬 우선 전략 (기존 로직)
      const localMemo = await offlineMemoService.updateMemo(memoId, memoData);
      return this.mapLocalMemoToResponse(localMemo);
    }
  },

  /**
   * 메모 삭제 (하이브리드 전략: 네트워크 상태 기반 분기)
   * - 온라인: 서버 우선 처리 후 IndexedDB 갱신
   * - 오프라인: 로컬 우선 처리 (Offline-First)
   * - 동기화 중: 요청 큐잉 (질문 6-1 개선)
   * @param {string|number} memoId - 메모 ID (localId 또는 serverId)
   * @returns {Promise<Object>} 삭제 결과
   */
  async deleteMemo(memoId) {
    if (networkMonitor.isOnline) {
      // 동기화 중이면 요청 큐에 추가 (질문 6-1 개선)
      if (syncStateManager.isSyncing) {
        console.log('[MemoService] 동기화 중이므로 요청 큐에 추가: deleteMemo');
        return await requestQueueManager.enqueue(
          () => this.deleteMemo(memoId),
          { type: 'delete', memoId }
        );
      }

      // 온라인: 서버 우선 전략
      try {
        // 1. 로컬 메모 조회 (serverId 확인용)
        const localMemo = await MemoOperationHelper.getLocalMemo(memoId);
        
        let serverId = memoId;
        if (localMemo && localMemo.serverId) {
          serverId = localMemo.serverId;
        } else if (!localMemo) {
          // 로컬에 없으면 서버에서 삭제 시도 (서버에만 존재할 수 있음)
          serverId = memoId;
        } else {
          // serverId가 없는 로컬 메모는 오프라인 로직으로 전환
          return await offlineMemoService.deleteMemo(memoId)
            .then(result => {
              if (result.deleted && result.localOnly) {
                return { message: '메모가 삭제되었습니다.' };
              } else {
                return { message: '메모 삭제가 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.' };
              }
            });
        }

        // 2. 서버에서 먼저 삭제 시도
        await apiClient.delete(API_ENDPOINTS.MEMOS.DELETE(serverId));
        
        // 3. 성공 시 IndexedDB 갱신
        await MemoOperationHelper.updateLocalAfterDelete(serverId);
        
        return { message: '메모가 삭제되었습니다.' };
      } catch (error) {
        // 서버 실패 시 오프라인 모드로 전환
        return await MemoOperationHelper.handleServerError(
          error,
          memoId,
          async () => {
            const result = await offlineMemoService.deleteMemo(memoId);
            if (result.deleted && result.localOnly) {
              return { message: '메모가 삭제되었습니다.' };
            } else {
              return { message: '메모 삭제가 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.' };
            }
          }
        );
      }
    } else {
      // 오프라인: 로컬 우선 전략 (기존 로직)
      const result = await offlineMemoService.deleteMemo(memoId);
      
      if (result.deleted && result.localOnly) {
        return { message: '메모가 삭제되었습니다.' };
      } else {
        return { message: '메모 삭제가 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.' };
      }
    }
  },

  /**
   * 특정 책의 메모 조회 (서버 우선 전략)
   * - 온라인: 서버에서만 조회, IndexedDB는 캐시로만 사용 (오프라인 대비)
   * - 오프라인: IndexedDB에서만 조회
   * @param {number} userBookId - 사용자 책 ID
   * @param {string} [date] - 조회할 날짜 (ISO 8601 형식: YYYY-MM-DD, 선택사항)
   * @returns {Promise<Array<Object>>} MemoResponse 리스트
   */
  async getMemosByBook(userBookId, date = null) {
    // 온라인 상태면 서버에서만 조회 (IndexedDB 읽기 안 함)
    if (networkMonitor.isOnline) {
      // 동기화 중이면 대기
      if (syncStateManager.isSyncing) {
        console.log('[MemoService] 동기화 중이므로 대기...');
        const isSyncComplete = await syncStateManager.waitForSyncComplete();
        if (!isSyncComplete) {
          console.warn('[MemoService] 동기화 완료 대기 타임아웃, 서버 조회 시도');
        }
      }

      try {
        const params = {};
        if (date) params.date = date;
    
        // 서버에서 조회
        const serverMemos = await apiClient.get(API_ENDPOINTS.MEMOS.BY_BOOK(userBookId), params);

        // 서버 메모를 IndexedDB에 캐시로 저장 (오프라인 대비)
        // 비동기로 처리하여 응답 지연 방지
        Promise.all(serverMemos.map(serverMemo => 
          MemoOperationHelper.saveServerMemoAsLocal(serverMemo).catch(err => 
            console.warn('[MemoService] IndexedDB 캐시 저장 실패 (무시):', err)
          )
        )).catch(() => {}); // 모든 실패 무시

        // 서버 데이터만 반환 (IndexedDB 읽기 안 함)
        return serverMemos;
      } catch (error) {
        console.error('서버 메모 조회 실패, IndexedDB 폴백 시도:', error);
        
        // 서버 실패 시에만 IndexedDB에서 조회 (오프라인 폴백)
        try {
          const localMemos = await offlineMemoService.getMemosByBook(userBookId);
          return this.mapLocalMemosToResponse(localMemos);
        } catch (localError) {
          console.error('IndexedDB 조회도 실패:', localError);
          throw error; // 원래 에러를 다시 던짐
        }
      }
    } else {
      // 오프라인 상태면 IndexedDB에서만 조회
      const localMemos = await offlineMemoService.getMemosByBook(userBookId);
      return this.mapLocalMemosToResponse(localMemos);
    }
  },

  /**
   * 로컬 메모와 서버 메모 통합
   * 시나리오 6 개선: 동기화 대기 중인 메모 우선 표시
   * @param {Array} localMemos - 로컬 메모 배열
   * @param {Array} serverMemos - 서버 메모 배열
   * @returns {Array} 통합된 메모 배열
   */
  mergeMemos(localMemos, serverMemos) {
    // 서버 메모를 맵으로 변환 (중복 제거용)
    const serverMemoMap = new Map();
    serverMemos.forEach(memo => {
      serverMemoMap.set(memo.id, memo);
    });

    const result = [];
    const processedServerIds = new Set(); // 처리된 서버 ID 추적

    localMemos.forEach(localMemo => {
      if (localMemo.syncStatus === 'synced' && localMemo.serverId) {
        // 동기화 완료된 메모: 서버 메모로 대체
        const serverMemo = serverMemoMap.get(localMemo.serverId);
        if (serverMemo) {
          result.push(serverMemo);
          processedServerIds.add(localMemo.serverId);
          serverMemoMap.delete(localMemo.serverId);
        } else {
          result.push(this.mapLocalMemoToResponse(localMemo));
        }
      } else if (localMemo.serverId) {
        // 동기화 대기 중인 메모 (수정/삭제 대기)
        // syncStatus: 'pending', 'syncing', 'syncing_create', 'syncing_update', 'waiting' 등
        // 서버 메모는 제외하고 로컬 메모만 표시 (낡은 데이터 무시)
        result.push(this.mapLocalMemoToResponse(localMemo));
        processedServerIds.add(localMemo.serverId);
        serverMemoMap.delete(localMemo.serverId); // 중요: 서버 메모 제거하여 중복 방지
      } else {
        // 아직 동기화되지 않은 메모 (생성 대기)
        // serverId가 null이므로 서버 메모와 매칭 불가
        result.push(this.mapLocalMemoToResponse(localMemo));
      }
    });

    // 서버에만 있는 메모 추가 (처리되지 않은 메모만)
    serverMemoMap.forEach(memo => {
      if (!processedServerIds.has(memo.id)) {
        result.push(memo);
      }
    });

    // 시간순 정렬
    return result.sort((a, b) => {
      const timeA = new Date(a.memoStartTime || a.createdAt);
      const timeB = new Date(b.memoStartTime || b.createdAt);
      return timeA - timeB;
    });
  },

  /**
   * 로컬 메모를 MemoResponse 형식으로 변환
   * @param {Object} localMemo - 로컬 메모 객체
   * @returns {Object} MemoResponse 형식의 객체
   */
  mapLocalMemoToResponse(localMemo) {
    return {
      id: localMemo.serverId || localMemo.localId, // 서버 ID가 없으면 로컬 ID 사용
      localId: localMemo.localId,
      userBookId: localMemo.userBookId,
      content: localMemo.content,
      tags: localMemo.tags,
      pageNumber: localMemo.pageNumber,
      memoStartTime: localMemo.memoStartTime,
      syncStatus: localMemo.syncStatus,
      createdAt: localMemo.createdAt,
      updatedAt: localMemo.updatedAt
    };
  },

  /**
   * 로컬 메모 배열을 MemoResponse 배열로 변환
   * @param {Array} localMemos - 로컬 메모 배열
   * @returns {Array} MemoResponse 배열
   */
  mapLocalMemosToResponse(localMemos) {
    return localMemos.map(memo => this.mapLocalMemoToResponse(memo));
  },

  /**
   * 날짜별 로컬 메모 조회
   * @param {string} [date] - 조회할 날짜 (YYYY-MM-DD, 기본값: 오늘)
   * @returns {Promise<Array>} 로컬 메모 배열
   */
  async getLocalMemosByDate(date = null) {
    const targetDate = date || getTodayDateString();
    const allLocalMemos = await offlineMemoService.getAllMemos();
    
    // 날짜별 필터링 (memoStartTime 기준)
    return allLocalMemos.filter(memo => {
      if (!memo.memoStartTime) return false;
      const memoDate = new Date(memo.memoStartTime);
      const targetDateObj = new Date(targetDate);
      
      // 날짜만 비교 (시간 제외)
      return memoDate.toDateString() === targetDateObj.toDateString();
    });
  },

  /**
   * 로컬 메모를 TodayFlowResponse 형식으로 변환
   * @param {Array} localMemos - 로컬 메모 배열
   * @param {string} sortBy - 정렬 방식 (SESSION, BOOK, TAG)
   * @param {string} [tagCategory] - 태그 대분류 (TYPE, TOPIC)
   * @returns {Object} TodayFlowResponse 형식의 객체
   */
  mapLocalMemosToTodayFlowResponse(localMemos, sortBy = 'SESSION', tagCategory = 'TYPE') {
    const memos = this.mapLocalMemosToResponse(localMemos);
    
    // 기본 응답 구조
    const response = {
      memosByBook: {},
      memosByTag: {},
      totalMemoCount: memos.length
    };

    if (sortBy === 'BOOK' || sortBy === 'SESSION') {
      // 책별로 그룹화
      memos.forEach(memo => {
        const bookId = memo.userBookId;
        if (!response.memosByBook[bookId]) {
          response.memosByBook[bookId] = {
            bookId: memo.userBookId,
            memos: []
          };
        }
        response.memosByBook[bookId].memos.push(memo);
      });
    }

    if (sortBy === 'TAG') {
      // 태그별로 그룹화
      memos.forEach(memo => {
        if (memo.tags && memo.tags.length > 0) {
          memo.tags.forEach(tag => {
            // 태그 대분류 필터링 (간단한 구현)
            if (!response.memosByTag[tag]) {
              response.memosByTag[tag] = {
                tagCode: tag,
                memos: []
              };
            }
            response.memosByTag[tag].memos.push(memo);
          });
        }
      });
    }

    return response;
  },

  /**
   * 책 덮기 (독서 활동 종료)
   * @param {number} userBookId - 사용자 책 ID
   * @param {Object} requestData - 책 덮기 요청 데이터
   * @param {number} requestData.lastReadPage - 마지막으로 읽은 페이지 수
   * @param {string} [requestData.readingFinishedDate] - 독서 종료일 (Finished 카테고리일 때만)
   * @param {number} [requestData.rating] - 평점 (Finished 카테고리일 때만)
   * @param {string} [requestData.review] - 후기 (Finished 카테고리일 때만, 선택사항)
   * @returns {Promise<string>} 성공 메시지
   */
  async closeBook(userBookId, requestData) {
    const response = await apiClient.post(API_ENDPOINTS.MEMOS.CLOSE_BOOK(userBookId), requestData);
    return response; // 성공 메시지 반환
  },

  /**
   * 최근 메모 작성 책 목록 조회
   * @param {number} [months] - 조회 기간 (개월 수, 기본값: 1)
   * @returns {Promise<Array<Object>>} BookResponse 리스트
   */
  async getRecentMemoBooks(months = 1) {
    const params = { months };
    const response = await apiClient.get(API_ENDPOINTS.MEMOS.RECENT_BOOKS, params);
    return response; // List<BookResponse> 반환
  },
};

