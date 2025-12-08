/**
 * 메모 관련 API 서비스
 * 오늘의 흐름, 메모 작성/수정/삭제 등의 API 호출 함수 제공
 * 오프라인 지원: 로컬 저장 및 자동 동기화 기능 통합
 */

import { apiClient } from './api-client.js';
import { API_ENDPOINTS } from '../constants/api-endpoints.js';
import { offlineMemoService } from './offline-memo-service.js';
import { networkMonitor } from '../utils/network-monitor.js';

export const memoService = {
  /**
   * 오늘의 흐름 조회
   * @param {Object} [params] - 조회 파라미터
   * @param {string} [params.date] - 조회할 날짜 (ISO 8601 형식: YYYY-MM-DD, 기본값: 오늘)
   * @param {string} [params.sortBy] - 정렬 방식 (SESSION, BOOK, TAG, 기본값: SESSION)
   * @param {string} [params.tagCategory] - 태그 대분류 (TYPE, TOPIC, 기본값: TYPE)
   * @returns {Promise<Object>} TodayFlowResponse
   */
  async getTodayFlow({ date, sortBy = 'SESSION', tagCategory } = {}) {
    const params = {};
    if (date) params.date = date;
    if (sortBy) params.sortBy = sortBy;
    // TAG 모드일 때만 tagCategory 추가
    if (tagCategory) {
      params.tagCategory = tagCategory;
    }
    
    const response = await apiClient.get(API_ENDPOINTS.MEMOS.TODAY_FLOW, params);
    return response; // TodayFlowResponse 반환
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
   * 메모 작성 (온라인/오프라인 자동 처리)
   * 항상 로컬 저장소에 먼저 저장하고, 온라인 상태면 즉시 동기화 시도
   * @param {Object} memoData - 메모 작성 데이터
   * @param {number} memoData.userBookId - 사용자 책 ID
   * @param {number} [memoData.pageNumber] - 페이지 번호
   * @param {string} memoData.content - 메모 내용
   * @param {Array<string>} [memoData.tags] - 태그 코드 리스트
   * @param {string} [memoData.memoStartTime] - 메모 시작 시간 (ISO 8601 형식, 기본값: 현재 시간)
   * @returns {Promise<Object>} MemoResponse (로컬 메모를 MemoResponse 형식으로 변환)
   */
  async createMemo(memoData) {
    // 항상 로컬 저장소에 먼저 저장 (Offline-First)
    const localMemo = await offlineMemoService.createMemo(memoData);

    // 온라인 상태면 즉시 동기화 시도, 오프라인이면 대기
    if (networkMonitor.isOnline) {
      // 백그라운드에서 동기화 (await 하지 않음)
      offlineMemoService.syncPendingMemos().catch(error => {
        console.error('백그라운드 동기화 실패:', error);
      });
    }

    // 로컬 메모를 즉시 반환 (낙관적 업데이트)
    return this.mapLocalMemoToResponse(localMemo);
  },

  /**
   * 메모 수정 (온라인/오프라인 자동 처리)
   * 로컬 저장소에 먼저 저장하고, 온라인 상태면 즉시 동기화 시도
   * @param {string|number} memoId - 메모 ID (localId 또는 serverId)
   * @param {Object} memoData - 메모 수정 데이터
   * @param {string} [memoData.content] - 메모 내용
   * @param {Array<string>} [memoData.tags] - 태그 코드 리스트
   * @param {number} [memoData.pageNumber] - 페이지 번호
   * @param {string} [memoData.memoStartTime] - 메모 시작 시간
   * @returns {Promise<Object>} MemoResponse (로컬 메모를 MemoResponse 형식으로 변환)
   */
  async updateMemo(memoId, memoData) {
    // 오프라인 메모 서비스를 통해 수정 (로컬 저장 및 동기화 큐 추가)
    const localMemo = await offlineMemoService.updateMemo(memoId, memoData);

    // 온라인 상태면 즉시 동기화 시도, 오프라인이면 대기
    if (networkMonitor.isOnline) {
      // 백그라운드에서 동기화 (await 하지 않음)
      offlineMemoService.syncPendingMemos().catch(error => {
        console.error('백그라운드 동기화 실패:', error);
      });
    }

    // 로컬 메모를 즉시 반환 (낙관적 업데이트)
    return this.mapLocalMemoToResponse(localMemo);
  },

  /**
   * 메모 삭제 (온라인/오프라인 자동 처리)
   * 로컬 저장소에서 삭제 표시하고, 온라인 상태면 즉시 동기화 시도
   * @param {string|number} memoId - 메모 ID (localId 또는 serverId)
   * @returns {Promise<Object>} 삭제 결과
   */
  async deleteMemo(memoId) {
    // 오프라인 메모 서비스를 통해 삭제 (로컬 저장 및 동기화 큐 추가)
    const result = await offlineMemoService.deleteMemo(memoId);

    // 온라인 상태면 즉시 동기화 시도, 오프라인이면 대기
    if (networkMonitor.isOnline) {
      // 백그라운드에서 동기화 (await 하지 않음)
      offlineMemoService.syncPendingMemos().catch(error => {
        console.error('백그라운드 동기화 실패:', error);
      });
    }

    // 삭제 결과 반환
    if (result.deleted && result.localOnly) {
      // 아직 동기화되지 않은 메모는 즉시 삭제됨
      return { message: '메모가 삭제되었습니다.' };
    } else {
      // 동기화 대기 중인 메모
      return { message: '메모 삭제가 예약되었습니다. 네트워크 복구 시 자동 동기화됩니다.' };
    }
  },

  /**
   * 특정 책의 메모 조회 (로컬 + 서버 통합)
   * 하이브리드 전략: 최근 7일 메모만 IndexedDB에 저장
   * @param {number} userBookId - 사용자 책 ID
   * @param {string} [date] - 조회할 날짜 (ISO 8601 형식: YYYY-MM-DD, 선택사항)
   * @returns {Promise<Array<Object>>} MemoResponse 리스트 (로컬 메모와 서버 메모 통합)
   */
  async getMemosByBook(userBookId, date = null) {
    // 로컬 메모 조회
    const localMemos = await offlineMemoService.getMemosByBook(userBookId);

    // 온라인 상태면 서버에서도 조회하여 통합
    if (networkMonitor.isOnline) {
      try {
    const params = {};
    if (date) params.date = date;
    
        const serverMemos = await apiClient.get(API_ENDPOINTS.MEMOS.BY_BOOK(userBookId), params);

        // 하이브리드 전략: 최근 7일 메모만 IndexedDB에 저장
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        for (const serverMemo of serverMemos) {
          const memoDate = new Date(serverMemo.memoStartTime || serverMemo.createdAt);
          
          // 최근 7일 메모만 IndexedDB에 저장 (오프라인 조회용)
          if (memoDate >= sevenDaysAgo) {
            await offlineMemoService.saveServerMemoAsLocal(serverMemo);
          }
          // 오래된 메모는 저장하지 않음 (서버에서만 조회)
        }

        // 로컬 메모와 서버 메모 통합
        return this.mergeMemos(localMemos, serverMemos);
      } catch (error) {
        console.error('서버 메모 조회 실패, 로컬 메모만 반환:', error);
        return this.mapLocalMemosToResponse(localMemos);
      }
    } else {
      // 오프라인 상태면 로컬 메모만 반환
      // (최근 7일 메모가 IndexedDB에 저장되어 있음)
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

