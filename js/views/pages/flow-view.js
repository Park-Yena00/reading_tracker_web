/**
 * 오늘의 흐름 페이지 뷰
 * 바인더 노트 형식의 메모 작성 및 관리 화면
 */

import { memoService } from '../../services/memo-service.js';
import { bookService } from '../../services/book-service.js';
import { authHelper } from '../../utils/auth-helper.js';
import { MemoCard } from '../../components/memo-card.js';
import { CalendarModal } from '../../components/calendar-modal.js';
import { BookSelector } from '../../components/book-selector.js';
import { MemoEditor } from '../../components/memo-editor.js';
import { HeaderView } from '../common/header.js';
import { FooterView } from '../common/footer.js';
import { ROUTES } from '../../constants/routes.js';

class FlowView {
  constructor() {
    // DOM 요소
    this.loadingSpinner = null;
    this.currentDateEl = null;
    this.btnCalendar = null;
    this.groupingToggle = null;
    this.tagCategoryToggle = null;
    this.tagCategorySection = null;
    this.inlineCalendarSection = null;
    this.inlineCalendarContainer = null;
    this.memoList = null;
    this.memoEditor = null;
    this.memoInput = null;
    this.tagChips = null;
    this.btnSaveMemo = null;
    this.btnSelectBook = null;
    this.bookSelectorContainer = null;
    this.memoInputContainer = null;
    this.selectedBookInfo = null;
    this.selectedBookTitle = null;
    this.selectedBookAuthor = null;
    this.emptyState = null;
    this.btnCloseBook = null;
    this.closeBookModal = null;
    this.closeBookModalClose = null;
    this.closeBookCancel = null;
    this.closeBookConfirm = null;
    this.closeBookProgress = null;
    this.closeBookTotalPages = null;
    
    // 상태
    this.currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.currentGrouping = 'SESSION'; // SESSION, BOOK, TAG
    this.currentTagCategory = 'TYPE'; // TYPE, TOPIC
    this.selectedBookId = null; // 선택된 책의 userBookId
    this.selectedBook = null; // 선택된 책 정보
    this.memos = []; // 현재 표시 중인 메모 목록
    this.editingMemoId = null; // 수정 중인 메모 ID
    this.isCalendarVisible = false; // 인라인 캘린더 표시 여부
    this.calendarYear = new Date().getFullYear();
    this.calendarMonth = new Date().getMonth() + 1; // 1-12
    this.calendarMemoDates = []; // 메모가 작성된 날짜 목록
    
    // 페이지네이션 상태
    this.currentPage = 1; // 현재 페이지 (1부터 시작)
    this.memosPerPage = 5; // 페이지당 메모 개수
    this.totalPages = 1; // 전체 페이지 수
    
    // 컴포넌트
    this.calendarModal = null;
    this.bookSelector = null;
    this.memoEditor = null;
    
    // 이벤트 구독 관리
    this.unsubscribers = [];
    
    // 이벤트 리스너 참조 (정리용)
    this.eventListeners = [];
    
    // 날짜 변경 감지 인터벌 ID
    this.dateChangeIntervalId = null;
    
    // 이벤트 핸들러 바인딩 (destroy에서 제거하기 위해)
    this.handleCalendarClick = this.handleCalendarClick.bind(this);
    this.handleInlineCalendarClick = this.handleInlineCalendarClick.bind(this);
    this.handleGroupingToggleClick = this.handleGroupingToggleClick.bind(this);
    this.handleTagCategoryToggleClick = this.handleTagCategoryToggleClick.bind(this);
    this.handleSelectBookClick = this.handleSelectBookClick.bind(this);
    this.handleHomeClick = this.handleHomeClick.bind(this);
    this.handleMemoListClick = this.handleMemoListClick.bind(this);
    
    // 보호된 페이지: 인증 확인 (비동기)
    this.initAuth();
  }

  /**
   * 인증 확인 및 초기화
   */
  async initAuth() {
    const isAuthenticated = await authHelper.checkAuth();
    if (!isAuthenticated) {
      return;
    }
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    // 헤더와 푸터 렌더링
    new HeaderView('header');
    new FooterView('footer');
    
    // DOM 요소 선택
    this.loadingSpinner = document.getElementById('loading-spinner');
    this.currentDateEl = document.getElementById('current-date');
    this.btnCalendar = document.getElementById('btn-calendar');
    this.groupingToggle = document.getElementById('grouping-toggle');
    this.tagCategoryToggle = document.getElementById('tag-category-tabs');
    this.tagCategorySection = document.getElementById('tag-category-section');
    this.inlineCalendarSection = document.getElementById('inline-calendar-section');
    this.inlineCalendarContainer = document.getElementById('inline-calendar-container');
    this.memoList = document.getElementById('memo-list');
    this.memoEditor = document.getElementById('memo-editor');
    this.memoInput = document.getElementById('memo-input');
    this.tagChips = document.getElementById('tag-chips');
    this.btnSaveMemo = document.getElementById('btn-save-memo');
    this.btnSelectBook = document.getElementById('btn-select-book');
    this.memoInputContainer = document.getElementById('memo-input-container');
    this.selectedBookInfo = document.getElementById('selected-book-info');
    this.selectedBookTitle = document.getElementById('selected-book-title');
    this.selectedBookAuthor = document.getElementById('selected-book-author');
    this.btnCloseBook = document.getElementById('btn-close-book');
    this.closeBookModal = document.getElementById('close-book-modal');
    this.closeBookModalClose = document.getElementById('close-book-modal-close');
    this.closeBookCancel = document.getElementById('close-book-cancel');
    this.closeBookConfirm = document.getElementById('close-book-confirm');
    this.closeBookProgress = document.getElementById('close-book-progress');
    this.closeBookTotalPages = document.getElementById('close-book-total-pages');
    this.closeBookFinishedFields = document.getElementById('close-book-finished-fields');
    this.closeBookFinishedDate = document.getElementById('close-book-finished-date');
    this.closeBookRatingStars = document.getElementById('close-book-rating-stars');
    this.closeBookRating = document.getElementById('close-book-rating');
    this.closeBookReview = document.getElementById('close-book-review');
    this.emptyState = document.getElementById('empty-state');
    this.flowContent = document.querySelector('.flow-content'); // 메모 에디터 임시 보관용
    this.memoPagination = document.getElementById('memo-pagination');
    this.btnPrevPage = document.getElementById('btn-prev-page');
    this.btnNextPage = document.getElementById('btn-next-page');
    this.paginationInfo = document.getElementById('pagination-info');
    
    if (!this.memoList || !this.memoEditor) {
      console.error('Required DOM elements not found');
      return;
    }
    
    // 이벤트 리스너 등록
    this.setupEventListeners();
    
    // 캘린더 모달 초기화
    this.calendarModal = new CalendarModal('calendar-modal');
    
    // 책 선택 모달 초기화
    this.bookSelector = new BookSelector('book-selector-modal');
    
    // 메모 에디터 초기화
    this.memoEditor = new MemoEditor('memo-editor');
    this.memoEditor.setOnSave((memoData) => {
      this.handleMemoSave(memoData);
    });
    this.memoEditor.setOnCancel(() => {
      this.handleMemoCancel();
    });
    
    // 초기 데이터 로드
    this.loadMemoFlow();
    
    // 날짜 변경 감지 (1분마다 확인)
    this.startDateChangeDetection();
  }

  /**
   * 이벤트 리스너 설정
   */
  setupEventListeners() {
    // 캘린더 버튼 (인라인 캘린더 토글)
    if (this.btnCalendar) {
      this.btnCalendar.addEventListener('click', this.handleCalendarClick);
      this.eventListeners.push({ element: this.btnCalendar, event: 'click', handler: this.handleCalendarClick });
    }
    
    // 인라인 캘린더 이벤트 위임
    if (this.inlineCalendarContainer) {
      this.inlineCalendarContainer.addEventListener('click', this.handleInlineCalendarClick);
      this.eventListeners.push({ element: this.inlineCalendarContainer, event: 'click', handler: this.handleInlineCalendarClick });
    }
    
    // 그룹화 선택
    if (this.groupingToggle) {
      this.groupingToggle.addEventListener('click', this.handleGroupingToggleClick);
      this.eventListeners.push({ element: this.groupingToggle, event: 'click', handler: this.handleGroupingToggleClick });
    }
    
    // 태그 대분류 선택
    if (this.tagCategoryToggle) {
      this.tagCategoryToggle.addEventListener('click', this.handleTagCategoryToggleClick);
      this.eventListeners.push({ element: this.tagCategoryToggle, event: 'click', handler: this.handleTagCategoryToggleClick });
    }
    
    // 책 선택 버튼
    if (this.btnSelectBook) {
      this.btnSelectBook.addEventListener('click', this.handleSelectBookClick);
      this.eventListeners.push({ element: this.btnSelectBook, event: 'click', handler: this.handleSelectBookClick });
    }
    
    // 책 덮기 버튼
    if (this.btnCloseBook) {
      this.btnCloseBook.addEventListener('click', this.handleCloseBookClick);
      this.eventListeners.push({ element: this.btnCloseBook, event: 'click', handler: this.handleCloseBookClick });
    }
    
    // 책 덮기 모달 이벤트 리스너
    if (this.closeBookModalClose) {
      this.closeBookModalClose.addEventListener('click', () => this.hideCloseBookModal());
      this.eventListeners.push({ element: this.closeBookModalClose, event: 'click', handler: () => this.hideCloseBookModal() });
    }
    
    if (this.closeBookCancel) {
      this.closeBookCancel.addEventListener('click', () => this.hideCloseBookModal());
      this.eventListeners.push({ element: this.closeBookCancel, event: 'click', handler: () => this.hideCloseBookModal() });
    }
    
    if (this.closeBookConfirm) {
      this.closeBookConfirm.addEventListener('click', this.handleCloseBookConfirm);
      this.eventListeners.push({ element: this.closeBookConfirm, event: 'click', handler: this.handleCloseBookConfirm });
    }
    
    // 모달 외부 클릭 시 닫기
    if (this.closeBookModal) {
      this.closeBookModal.addEventListener('click', (e) => {
        if (e.target === this.closeBookModal) {
          this.hideCloseBookModal();
        }
      });
    }
    
    // 메모 저장은 memo-editor 컴포넌트에서 처리
    
    // 홈으로 버튼
    const btnHome = document.getElementById('btn-home');
    if (btnHome) {
      btnHome.addEventListener('click', this.handleHomeClick);
      this.eventListeners.push({ element: btnHome, event: 'click', handler: this.handleHomeClick });
    }
    
    // 메모 카드 이벤트 위임 (수정/삭제)
    if (this.memoList) {
      this.memoList.addEventListener('click', this.handleMemoListClick);
      this.eventListeners.push({ element: this.memoList, event: 'click', handler: this.handleMemoListClick });
    }
    
    // 페이지네이션 버튼 이벤트
    if (this.btnPrevPage) {
      this.btnPrevPage.addEventListener('click', () => this.goToPage(this.currentPage - 1));
    }
    if (this.btnNextPage) {
      this.btnNextPage.addEventListener('click', () => this.goToPage(this.currentPage + 1));
    }
  }

  /**
   * 캘린더 버튼 클릭 처리
   */
  handleCalendarClick() {
    this.toggleInlineCalendar();
  }

  /**
   * 인라인 캘린더 클릭 이벤트 처리
   * @param {Event} e - 클릭 이벤트
   */
  handleInlineCalendarClick(e) {
    const prevBtn = e.target.closest('.calendar-nav-btn.prev');
    const nextBtn = e.target.closest('.calendar-nav-btn.next');
    const dayEl = e.target.closest('.calendar-day');
    
    if (prevBtn) {
      e.preventDefault();
      this.navigateCalendarMonth(-1);
    } else if (nextBtn) {
      e.preventDefault();
      this.navigateCalendarMonth(1);
    } else if (dayEl) {
      const date = dayEl.dataset.date;
      if (date) {
        this.handleCalendarDateClick(date);
      }
    }
  }

  /**
   * 그룹화 토글 클릭 이벤트 처리
   * @param {Event} e - 클릭 이벤트
   */
  handleGroupingToggleClick(e) {
    const btn = e.target.closest('.grouping-btn');
    if (btn) {
      const grouping = btn.dataset.grouping;
      this.handleGroupingChange(grouping);
    }
  }

  /**
   * 태그 대분류 토글 클릭 이벤트 처리
   * @param {Event} e - 클릭 이벤트
   */
  handleTagCategoryToggleClick(e) {
    const tab = e.target.closest('.tag-category-tab');
    if (tab) {
      const category = tab.dataset.category;
      this.handleTagCategoryChange(category);
      // 메모 에디터와는 연동하지 않음 (별개의 작업)
    }
  }

  /**
   * 책 선택 버튼 클릭 처리
   * 메모 작성은 항상 오늘 날짜에서만 가능하므로, 다른 날짜를 보고 있다면 오늘 날짜로 전환
   */
  handleSelectBookClick() {
    // 오늘 날짜로 전환
    const today = new Date().toISOString().split('T')[0];
    if (this.currentDate !== today) {
      // 오늘 날짜로 전환 후 책 선택 모달 표시
      this.loadMemoFlow(today).then(() => {
        this.showBookSelector();
      });
    } else {
      // 이미 오늘 날짜면 바로 책 선택 모달 표시
      this.showBookSelector();
    }
  }

  /**
   * 홈으로 버튼 클릭 처리
   * @param {Event} e - 클릭 이벤트
   */
  handleHomeClick(e) {
    e.preventDefault();
    window.location.href = ROUTES.HOME;
  }

  /**
   * 메모 리스트 클릭 이벤트 처리
   * @param {Event} e - 클릭 이벤트
   */
  handleMemoListClick(e) {
    const editBtn = e.target.closest('.memo-edit-btn');
    const deleteBtn = e.target.closest('.memo-delete-btn');
    
    if (editBtn) {
      const memoId = parseInt(editBtn.dataset.memoId);
      this.handleMemoEdit(memoId);
    } else if (deleteBtn) {
      const memoId = parseInt(deleteBtn.dataset.memoId);
      this.handleMemoDelete(memoId);
    }
  }

  /**
   * 오늘의 흐름 로드
   * @param {string} [date] - 조회할 날짜 (YYYY-MM-DD, 기본값: 현재 날짜)
   * @param {string} [grouping] - 그룹화 방식 (SESSION, BOOK, TAG, 기본값: this.currentGrouping)
   */
  async loadMemoFlow(date = null, grouping = null) {
    this.setLoading(true);
    this.hideEmptyState();
    
    const targetDate = date || this.currentDate;
    const targetGrouping = grouping || this.currentGrouping;
    
    try {
      const params = {
        date: targetDate,
        sortBy: targetGrouping,
      };
      
      // TAG 모드일 때만 tagCategory 추가 (SESSION 모드에서는 전달하지 않음)
      if (targetGrouping === 'TAG') {
        params.tagCategory = this.currentTagCategory;
      }
      
      const response = await memoService.getTodayFlow(params);
      
      this.currentDate = targetDate;
      this.currentGrouping = targetGrouping;
      
      // 날짜 표시 업데이트
      this.updateDateDisplay();
      
      // 메모 렌더링
      this.renderMemos(response);
      
    } catch (error) {
      console.error('오늘의 흐름 로드 오류:', error);
      
      // 403 또는 404 에러는 메모가 없는 것으로 간주 (정상적인 상태)
      // 메모가 없을 때는 빈 상태를 표시하고 메모 작성 UI를 활성화
      if (error.status === 403 || error.status === 404 || error.statusCode === 403 || error.statusCode === 404 ||
          (error.message && (error.message.includes('403') || error.message.includes('404') || error.message.includes('Forbidden')))) {
        // 선택된 책이 있으면 빈 섹션 생성 및 메모 작성 UI 표시
        if (this.selectedBookId && this.selectedBook) {
          // 빈 메모 목록으로 renderMemos 호출하여 메모 작성 UI 표시
          this.renderMemos({ 
            memosByBook: {},
            memosByTag: {},
            totalMemoCount: 0
          });
        } else {
          this.showEmptyState();
          // 메모 작성 UI 숨김 (책 선택 버튼 표시)
          if (this.memoInputContainer) {
            this.memoInputContainer.style.display = 'none';
          }
        }
      } else {
        // 다른 에러는 사용자에게 알림
        alert('메모를 불러오는 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
        this.showEmptyState();
      }
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 날짜 표시 업데이트
   */
  updateDateDisplay() {
    if (this.currentDateEl) {
      const date = new Date(this.currentDate);
      const formattedDate = date.toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      });
      this.currentDateEl.textContent = formattedDate;
    }
  }

  /**
   * 메모 렌더링
   * @param {Object} response - TodayFlowResponse
   */
  renderMemos(response) {
    if (!this.memoList) {
      console.error('[FlowView] memoList 요소를 찾을 수 없습니다.');
      return;
    }
    
    // 메모 에디터 보호: innerHTML = '' 실행 전에 memoList 밖으로 임시 이동
    let memoEditorWasInList = false;
    let memoEditorOriginalParent = null;
    
    if (this.memoEditor && this.memoEditor.container) {
      const parent = this.memoEditor.container.parentNode;
      // memoList 내부 또는 그 자식 요소에 있는지 확인
      if (parent && (parent === this.memoList || this.memoList.contains(parent))) {
        memoEditorWasInList = true;
        memoEditorOriginalParent = parent;
        
        // DOM에서 제거하지 않고 flow-content로 임시 이동 (이벤트 리스너 유지)
        if (this.flowContent && this.memoEditor.container.parentNode !== this.flowContent) {
          this.flowContent.appendChild(this.memoEditor.container);
          this.memoEditor.container.style.display = 'none'; // 임시로 숨김
        }
      }
    }
    
    // 기존 메모 섹션만 제거 (메모 에디터는 이미 flow-content로 이동됨)
    this.memoList.innerHTML = '';
    
    // api-client.js가 이미 response.data를 반환하므로 response 자체가 data임
    if (!response) {
      this.totalPages = 1;
      this.currentPage = 1;
      this.updatePagination();
      
      // 선택된 책이 있으면 빈 섹션 생성 및 메모 작성 UI 표시
      if (this.selectedBookId && this.selectedBook) {
        this.createEmptyBookSectionWithEditor();
        this.hideEmptyState();
      } else {
        this.showEmptyState();
        // 메모 에디터 복원
        if (memoEditorWasInList) {
          this.restoreMemoEditor();
        }
      }
      return;
    }
    
    // response가 이미 data 부분이므로 직접 사용
    const { memosByBook, memosByTag, totalMemoCount } = response;
    
    if (totalMemoCount === 0) {
      this.totalPages = 1;
      this.currentPage = 1;
      this.updatePagination();
      
      // 선택된 책이 있으면 빈 섹션 생성 및 메모 작성 UI 표시
      if (this.selectedBookId && this.selectedBook) {
        this.createEmptyBookSectionWithEditor();
        this.hideEmptyState();
      } else {
        this.showEmptyState();
        // 메모 에디터 복원
        if (memoEditorWasInList) {
          this.restoreMemoEditor();
        }
      }
      return;
    }
    
    // 그룹화 방식에 따라 렌더링
    if (this.currentGrouping === 'TAG' && memosByTag) {
      this.renderMemosByTag(memosByTag);
    } else if (this.currentGrouping === 'SESSION' && memosByBook) {
      // 섹션별 그룹화: 독서 세션 순서로 그룹화
      this.renderMemosBySession(memosByBook);
    } else if (memosByBook) {
      // 책별 그룹화: 책별로 그룹화
      this.renderMemosByBook(memosByBook);
    }
    
    // renderMemosByBook에서 마지막 페이지인 경우에만 메모 에디터를 삽입하므로
    // 여기서는 restoreMemoEditor를 호출하지 않음
    
    this.hideEmptyState();
  }


  /**
   * 섹션별 메모 렌더링 (페이지네이션 적용)
   * 독서 세션 순서로 그룹화: "책 선택하기 -> 책 덮기"가 하나의 섹션
   * @param {Object} memosByBook - 책별 메모 그룹 (백엔드에서 받은 데이터)
   */
  renderMemosBySession(memosByBook) {
    // 1. 모든 메모를 하나의 배열로 수집
    const allMemos = [];
    Object.values(memosByBook).forEach((bookGroup) => {
      if (bookGroup.memos && Array.isArray(bookGroup.memos)) {
        bookGroup.memos.forEach(memo => {
          // 책 정보 추가
          memo.bookId = bookGroup.bookId || memo.userBookId;
          memo.bookTitle = bookGroup.bookTitle || memo.bookTitle;
          allMemos.push(memo);
        });
      }
    });
    
    // 2. 모든 메모를 시간 순으로 정렬 (오래된 메모부터)
    allMemos.sort((a, b) => {
      const timeA = new Date(a.memoStartTime || a.createdAt);
      const timeB = new Date(b.memoStartTime || b.createdAt);
      return timeA - timeB;
    });
    
    // 3. 독서 세션별로 그룹화
    // 세션 구분: 책 ID가 변경되면 새로운 세션
    const sessions = [];
    let currentSession = null;
    
    allMemos.forEach((memo, index) => {
      const bookId = memo.bookId || memo.userBookId;
      
      // 첫 메모이거나 책 ID가 변경된 경우 새로운 세션 시작
      if (index === 0 || (currentSession && currentSession.bookId !== bookId)) {
        currentSession = {
          bookId: bookId,
          bookTitle: memo.bookTitle || '제목 없음',
          memos: [],
          firstMemoTime: new Date(memo.memoStartTime || memo.createdAt)
        };
        sessions.push(currentSession);
      }
      
      // 현재 세션에 메모 추가
      currentSession.memos.push(memo);
    });
    
    // 메모 배열 저장
    this.memos = allMemos;
    
    // 4. 전체 페이지 수 계산
    const previousTotalPages = this.totalPages;
    this.totalPages = Math.max(1, Math.ceil(allMemos.length / this.memosPerPage));
    
    // 새 메모가 추가되어 페이지 수가 증가했고, 이전에 마지막 페이지에 있었다면 새 마지막 페이지로 이동
    if (this.totalPages > previousTotalPages && this.currentPage === previousTotalPages) {
      this.currentPage = this.totalPages;
    }
    
    // 현재 페이지가 전체 페이지를 초과하면 마지막 페이지로 조정
    // 또는 메모 저장 후 항상 마지막 페이지로 이동하도록 함 (currentPage === 999인 경우)
    if (this.currentPage > this.totalPages || this.currentPage === 999) {
      this.currentPage = this.totalPages;
    }
    
    // 5. 현재 페이지의 메모 범위 계산
    const startIndex = (this.currentPage - 1) * this.memosPerPage;
    const endIndex = startIndex + this.memosPerPage;
    
    // 6. 현재 페이지에 표시할 세션 결정
    // 세션 단위로 페이지네이션 처리
    let currentMemoCount = 0;
    const sessionsForPage = [];
    
    for (const session of sessions) {
      const sessionStartIndex = currentMemoCount;
      const sessionEndIndex = currentMemoCount + session.memos.length;
      
      // 현재 페이지 범위와 겹치는 세션인지 확인
      if (sessionEndIndex > startIndex && sessionStartIndex < endIndex) {
        // 현재 페이지에 표시할 메모만 필터링
        const pageStartInSession = Math.max(0, startIndex - sessionStartIndex);
        const pageEndInSession = Math.min(session.memos.length, endIndex - sessionStartIndex);
        const memosForPage = session.memos.slice(pageStartInSession, pageEndInSession);
        
        if (memosForPage.length > 0) {
          sessionsForPage.push({
            bookId: session.bookId,
            bookTitle: session.bookTitle,
            memos: memosForPage
          });
        }
      }
      
      currentMemoCount += session.memos.length;
      
      // 이미 현재 페이지 범위를 넘어섰으면 중단
      if (sessionEndIndex >= endIndex) {
        break;
      }
    }
    
    if (sessionsForPage.length === 0) {
      // 메모가 없어도 선택된 책이 있고 마지막 페이지라면 빈 섹션 생성
      if (this.currentPage === this.totalPages && this.selectedBookId) {
        this.createEmptyBookSectionWithEditor();
        this.updatePagination();
        return;
      }
      this.showEmptyState();
      this.updatePagination();
      return;
    }
    
    // 7. 각 세션별로 섹션 컨테이너 생성 및 렌더링
    sessionsForPage.forEach((session) => {
      // 책 섹션 컨테이너 생성 (세션 = 책 섹션)
      const bookSection = this.renderBookSection(session, session.memos);
      const sectionElement = document.createRange().createContextualFragment(bookSection);
      this.memoList.appendChild(sectionElement.firstElementChild);
    });
    
    // 8. 마지막 페이지이고 선택된 책이 있는 경우에만 메모 작성 UI 삽입
    if (this.currentPage === this.totalPages && this.selectedBookId) {
      // 선택된 책의 마지막 세션 찾기
      const selectedBookSessions = sessions.filter(session => 
        session.bookId === this.selectedBookId || 
        String(session.bookId) === String(this.selectedBookId)
      );
      
      if (selectedBookSessions.length > 0) {
        // 선택된 책의 마지막 세션 (시간상 가장 마지막)
        const lastSession = selectedBookSessions[selectedBookSessions.length - 1];
        const lastMemo = lastSession.memos[lastSession.memos.length - 1];
        
        // 마지막 메모가 현재 페이지에 있는지 확인
        const lastMemoIndex = allMemos.findIndex(memo => memo.id === lastMemo.id);
        const isLastMemoInCurrentPage = lastMemoIndex >= startIndex && lastMemoIndex < endIndex;
        
        if (isLastMemoInCurrentPage) {
          // 선택된 책의 메모 섹션 찾기 (현재 페이지의 마지막 세션)
          const selectedBookSection = Array.from(this.memoList.querySelectorAll('.memo-book-section'))
            .filter(section => section.dataset.bookId === String(this.selectedBookId))
            .pop(); // 마지막 섹션
          
          if (selectedBookSection) {
            this.insertMemoEditorIntoSection(selectedBookSection);
          }
        } else {
          // 마지막 메모가 현재 페이지에 없으면 메모 작성 UI 숨김
          this.hideMemoEditor();
        }
      } else {
        // 선택된 책의 메모가 없으면 빈 섹션 생성
        this.createEmptyBookSectionWithEditor();
      }
    } else {
      // 마지막 페이지가 아니거나 선택된 책이 없으면 메모 작성 UI 숨김
      this.hideMemoEditor();
    }
    
    // 페이지네이션 UI 업데이트
    this.updatePagination();
  }

  /**
   * 책별 메모 렌더링 (페이지네이션 적용)
   * 책별로 그룹화: 같은 책의 모든 메모를 하나의 그룹으로 묶음
   * @param {Object} memosByBook - 책별 메모 그룹
   */
  renderMemosByBook(memosByBook) {
    // 1. 먼저 책별로 그룹화
    const bookGroups = [];
    Object.values(memosByBook).forEach((bookGroup) => {
      if (bookGroup.memos && Array.isArray(bookGroup.memos)) {
        // 각 책 그룹 내부에서 시간 순으로 정렬 (2차 기준: 시간 순)
        const sortedMemos = [...bookGroup.memos].sort((a, b) => {
          const timeA = new Date(a.memoStartTime || a.createdAt);
          const timeB = new Date(b.memoStartTime || b.createdAt);
          return timeA - timeB; // 오래된 메모부터
        });
        
        // 책 정보 추가
        sortedMemos.forEach(memo => {
          memo.bookId = bookGroup.bookId || memo.userBookId;
          memo.bookTitle = bookGroup.bookTitle || memo.bookTitle;
        });
        
        // 해당 날짜에 첫 메모가 작성된 시간 찾기 (책 그룹 배치 순서 결정용)
        const firstMemoTime = sortedMemos.length > 0 
          ? new Date(sortedMemos[0].memoStartTime || sortedMemos[0].createdAt)
          : new Date(0);
        
        bookGroups.push({
          bookId: bookGroup.bookId,
          bookTitle: bookGroup.bookTitle || '제목 없음',
          memos: sortedMemos,
          firstMemoTime: firstMemoTime // 책 그룹 배치 순서 결정용
        });
      }
    });
    
    // 2. 책 그룹의 배치 순서는 "해당 날짜에 첫 메모가 작성된 시간"을 기준으로 정렬 (1차 기준: 책별 그룹화)
    bookGroups.sort((a, b) => {
      return a.firstMemoTime - b.firstMemoTime; // 첫 메모가 먼저 작성된 책부터
    });
    
    // 3. 모든 메모를 하나의 배열로 수집 (페이지네이션 계산용)
    const allMemos = [];
    bookGroups.forEach(bookGroup => {
      allMemos.push(...bookGroup.memos);
    });
    
    // 메모 배열 저장
    this.memos = allMemos;
    
    // 4. 전체 페이지 수 계산
    const previousTotalPages = this.totalPages;
    this.totalPages = Math.max(1, Math.ceil(allMemos.length / this.memosPerPage));
    
    // 새 메모가 추가되어 페이지 수가 증가했고, 이전에 마지막 페이지에 있었다면 새 마지막 페이지로 이동
    if (this.totalPages > previousTotalPages && this.currentPage === previousTotalPages) {
      this.currentPage = this.totalPages;
    }
    
    // 현재 페이지가 전체 페이지를 초과하면 마지막 페이지로 조정
    // 또는 메모 저장 후 항상 마지막 페이지로 이동하도록 함 (currentPage === 999인 경우)
    if (this.currentPage > this.totalPages || this.currentPage === 999) {
      this.currentPage = this.totalPages;
    }
    
    // 5. 현재 페이지의 메모 범위 계산
    const startIndex = (this.currentPage - 1) * this.memosPerPage;
    const endIndex = startIndex + this.memosPerPage;
    
    // 6. 현재 페이지에 표시할 책 그룹 결정
    // 책 그룹 단위로 페이지네이션 처리
    let currentMemoCount = 0;
    const bookGroupsForPage = [];
    
    for (const bookGroup of bookGroups) {
      const bookGroupStartIndex = currentMemoCount;
      const bookGroupEndIndex = currentMemoCount + bookGroup.memos.length;
      
      // 현재 페이지 범위와 겹치는 책 그룹인지 확인
      if (bookGroupEndIndex > startIndex && bookGroupStartIndex < endIndex) {
        // 현재 페이지에 표시할 메모만 필터링
        const pageStartInGroup = Math.max(0, startIndex - bookGroupStartIndex);
        const pageEndInGroup = Math.min(bookGroup.memos.length, endIndex - bookGroupStartIndex);
        const memosForPage = bookGroup.memos.slice(pageStartInGroup, pageEndInGroup);
        
        if (memosForPage.length > 0) {
          bookGroupsForPage.push({
            bookId: bookGroup.bookId,
            bookTitle: bookGroup.bookTitle,
            memos: memosForPage
          });
        }
      }
      
      currentMemoCount += bookGroup.memos.length;
      
      // 이미 현재 페이지 범위를 넘어섰으면 중단
      if (bookGroupEndIndex >= endIndex) {
        break;
      }
    }
    
    if (bookGroupsForPage.length === 0) {
      // 메모가 없어도 선택된 책이 있고 마지막 페이지라면 빈 섹션 생성
      if (this.currentPage === this.totalPages && this.selectedBookId) {
        this.createEmptyBookSectionWithEditor();
        this.updatePagination();
        return;
      }
      this.showEmptyState();
      this.updatePagination();
      return;
    }
    
    // 7. 각 책 그룹별로 섹션 컨테이너 생성 및 렌더링
    bookGroupsForPage.forEach((bookGroup) => {
      // 책 섹션 컨테이너 생성
      const bookSection = this.renderBookSection(bookGroup, bookGroup.memos);
      const sectionElement = document.createRange().createContextualFragment(bookSection);
      this.memoList.appendChild(sectionElement.firstElementChild);
    });
    
    // 마지막 페이지이고 선택된 책이 있는 경우에만 메모 작성 UI 삽입
    if (this.currentPage === this.totalPages && this.selectedBookId) {
      // 선택된 책의 그룹 찾기
      const selectedBookGroup = bookGroups.find(group => 
        group.bookId === this.selectedBookId || 
        String(group.bookId) === String(this.selectedBookId)
      );
      
      if (selectedBookGroup && selectedBookGroup.memos.length > 0) {
        // 선택된 책의 마지막 메모 찾기 (이미 시간순으로 정렬되어 있음)
        const lastMemo = selectedBookGroup.memos[selectedBookGroup.memos.length - 1];
        
        // 마지막 메모가 현재 페이지에 있는지 확인
        const lastMemoIndex = allMemos.findIndex(memo => memo.id === lastMemo.id);
        const isLastMemoInCurrentPage = lastMemoIndex >= startIndex && lastMemoIndex < endIndex;
        
        if (isLastMemoInCurrentPage) {
          // 선택된 책의 메모 섹션 찾기
          const selectedBookSection = Array.from(this.memoList.querySelectorAll('.memo-book-section')).find(
            section => section.dataset.bookId === String(this.selectedBookId)
          );
          
          if (selectedBookSection) {
            this.insertMemoEditorIntoSection(selectedBookSection);
          }
        } else {
          // 마지막 메모가 현재 페이지에 없으면 메모 작성 UI 숨김
          this.hideMemoEditor();
        }
      } else {
        // 선택된 책의 메모가 없으면 빈 섹션 생성
        this.createEmptyBookSectionWithEditor();
      }
    } else {
      // 마지막 페이지가 아니거나 선택된 책이 없으면 메모 작성 UI 숨김
      this.hideMemoEditor();
    }
    
    // 페이지네이션 UI 업데이트
    this.updatePagination();
  }
  
  /**
   * 책 섹션 전체 렌더링 (도서명 + 메모 그리드)
   * @param {Object} bookGroup - 책 그룹 정보
   * @param {Array} sortedMemos - 정렬된 메모 배열
   * @returns {string} HTML 문자열
   */
  renderBookSection(bookGroup, sortedMemos) {
    const bookTitle = bookGroup.bookTitle || sortedMemos[0]?.bookTitle || '제목 없음';
    const bookId = bookGroup.bookId || sortedMemos[0]?.userBookId;
    
    // 도서명 헤더
    let html = `
      <div class="memo-book-section" data-book-id="${bookId}">
        <div class="memo-section-header">
          <h3 class="memo-section-title">${this.escapeHtml(bookTitle)}</h3>
        </div>
        <div class="memo-section-grid">
    `;
    
    // 메모 카드 렌더링
    sortedMemos.forEach((memo) => {
      html += MemoCard.render(memo);
    });
    
    html += `
        </div>
      </div>
    `;
    
    return html;
  }

  /**
   * 메모 작성 UI 숨김
   */
  hideMemoEditor() {
    if (this.memoEditor && this.memoEditor.container) {
      const parent = this.memoEditor.container.parentNode;
      // 메모 섹션 내부에 있으면 flow-content로 이동하고 숨김
      if (parent && (parent === this.memoList || this.memoList.contains(parent))) {
        if (this.flowContent && this.memoEditor.container.parentNode !== this.flowContent) {
          this.flowContent.appendChild(this.memoEditor.container);
        }
        this.memoEditor.container.style.display = 'none';
      }
      // 입력 컨테이너 숨김
      if (this.memoInputContainer) {
        this.memoInputContainer.style.display = 'none';
      }
    }
  }
  
  /**
   * 메모 섹션 내부에 입력 컴포넌트 삽입
   * @param {HTMLElement} sectionNode - 메모 섹션 DOM 노드
   */
  insertMemoEditorIntoSection(sectionNode) {
    if (!this.memoEditor || !this.memoEditor.container || !sectionNode) return;

    const memoGrid = sectionNode.querySelector('.memo-section-grid');
    if (!memoGrid) return;

    // 기존에 다른 곳에 있던 입력 컴포넌트 제거 (다른 섹션에 있을 수 있음)
    const existingEditor = this.memoList.querySelector('.memo-section-grid .memo-editor');
    if (existingEditor && existingEditor !== this.memoEditor.container) {
      existingEditor.remove();
    }

    // 기존 메모 에디터를 메모 그리드로 직접 이동
    if (this.memoEditor.container.parentNode !== memoGrid) {
      this.memoEditor.container.style.display = 'block';
      memoGrid.appendChild(this.memoEditor.container);
    }
    
    // 입력 컨테이너 표시
    if (this.memoInputContainer && this.selectedBookId) {
      this.memoInputContainer.style.display = 'block';
    }
  }

  /**
   * 빈 책 섹션 생성 (첫 메모 작성용)
   */
  createEmptyBookSectionWithEditor() {
    if (!this.selectedBook || !this.selectedBookId) return;

    const bookTitle = this.selectedBook.title || '제목 없음';
    const bookId = this.selectedBookId;

    // 빈 책 섹션 HTML 생성
    const sectionHtml = `
      <div class="memo-book-section" data-book-id="${bookId}">
        <div class="memo-section-header">
          <h3 class="memo-section-title">${this.escapeHtml(bookTitle)}</h3>
        </div>
        <div class="memo-section-grid">
        </div>
      </div>
    `;

    const sectionElement = document.createRange().createContextualFragment(sectionHtml);
    const sectionNode = this.memoList.appendChild(sectionElement.firstElementChild);
    
    // 입력 컴포넌트 삽입
    this.insertMemoEditorIntoSection(sectionNode);
  }
  
  /**
   * 메모 에디터를 올바른 위치에 복원
   */
  restoreMemoEditor() {
    if (!this.memoEditor || !this.memoEditor.container) return;
    
    // 선택된 책이 있는 경우에만 메모 섹션 내부로 이동
    if (this.selectedBookId) {
      // 선택된 책의 메모 섹션 찾기
      const selectedBookSection = Array.from(this.memoList.querySelectorAll('.memo-book-section')).find(
        section => section.dataset.bookId === String(this.selectedBookId)
      );
      
      if (selectedBookSection) {
        this.insertMemoEditorIntoSection(selectedBookSection);
      } else {
        // 선택된 책의 섹션이 없으면 빈 섹션 생성
        this.createEmptyBookSectionWithEditor();
      }
    } else {
      // 선택된 책이 없으면 flow-content의 원래 위치로 복원 (숨김 상태 유지)
      if (this.flowContent && this.memoEditor.container.parentNode !== this.flowContent) {
        this.flowContent.appendChild(this.memoEditor.container);
      }
      this.memoEditor.container.style.display = 'none';
    }
  }
  
  /**
   * HTML 이스케이프
   * @param {string} text - 이스케이프할 텍스트
   * @returns {string} 이스케이프된 텍스트
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 태그별 메모 렌더링 (페이지네이션 적용)
   * @param {Object} memosByTag - 태그별 메모 그룹
   */
  renderMemosByTag(memosByTag) {
    // 모든 메모를 하나의 배열로 수집 (페이지네이션 계산용)
    const allMemos = [];
    const tagSectionsData = []; // 태그 섹션 데이터 저장
    
    // 태그별로 섹션을 만들고, 각 태그 섹션 내부에서 시간순으로 정렬
    Object.entries(memosByTag).forEach(([tagCode, tagGroup]) => {
      if (tagGroup.memosByBook) {
        // 각 태그 섹션 내의 모든 메모를 수집
        const tagMemos = [];
        
        Object.values(tagGroup.memosByBook).forEach((bookGroup) => {
          if (bookGroup.memos && Array.isArray(bookGroup.memos)) {
            bookGroup.memos.forEach(memo => {
              // 책 정보 추가
              memo.bookId = bookGroup.bookId || memo.userBookId;
              memo.bookTitle = bookGroup.bookTitle || memo.bookTitle;
              tagMemos.push(memo);
            });
          }
        });
        
        // 태그 섹션 내부에서 시간순으로 정렬 (오래된 메모부터 상단에)
        tagMemos.sort((a, b) => {
          const timeA = new Date(a.memoStartTime || a.createdAt);
          const timeB = new Date(b.memoStartTime || b.createdAt);
          return timeA - timeB; // 시간 순 정렬
        });
        
        if (tagMemos.length > 0) {
          // 태그 섹션 데이터 저장
          tagSectionsData.push({
            tagCode: tagCode,
            memos: tagMemos,
            startIndex: allMemos.length
          });
          
          // 전체 메모 배열에 추가 (페이지네이션 계산용)
          allMemos.push(...tagMemos);
        }
      }
    });
    
    // 메모 배열 저장
    this.memos = allMemos;
    
    // 전체 페이지 수 계산
    const previousTotalPages = this.totalPages;
    this.totalPages = Math.max(1, Math.ceil(allMemos.length / this.memosPerPage));
    
    // 새 메모가 추가되어 페이지 수가 증가했고, 이전에 마지막 페이지에 있었다면 새 마지막 페이지로 이동
    if (this.totalPages > previousTotalPages && this.currentPage === previousTotalPages) {
      this.currentPage = this.totalPages;
    }
    
    // 현재 페이지가 전체 페이지를 초과하면 마지막 페이지로 조정
    // 또는 메모 저장 후 항상 마지막 페이지로 이동하도록 함 (currentPage === 999인 경우)
    if (this.currentPage > this.totalPages || this.currentPage === 999) {
      this.currentPage = this.totalPages;
    }
    
    if (allMemos.length === 0) {
      // 메모가 없어도 선택된 책이 있고 마지막 페이지라면 빈 섹션 생성
      if (this.currentPage === this.totalPages && this.selectedBookId) {
        this.createEmptyBookSectionWithEditor();
        this.updatePagination();
        return;
      }
      this.showEmptyState();
      this.updatePagination();
      return;
    }
    
    // 현재 페이지의 메모 범위 계산
    const startIndex = (this.currentPage - 1) * this.memosPerPage;
    const endIndex = startIndex + this.memosPerPage;
    
    // 태그 섹션 렌더링 (현재 페이지에 해당하는 메모만 표시)
    tagSectionsData.forEach((sectionData) => {
      const { tagCode, memos, startIndex: sectionStartIndex } = sectionData;
      const sectionEndIndex = sectionStartIndex + memos.length;
      
      // 현재 페이지 범위와 겹치는지 확인
      if (sectionEndIndex > startIndex && sectionStartIndex < endIndex) {
        // 현재 페이지에 해당하는 메모만 필터링
        const visibleMemos = memos.filter((memo, index) => {
          const globalIndex = sectionStartIndex + index;
          return globalIndex >= startIndex && globalIndex < endIndex;
        });
        
        if (visibleMemos.length > 0) {
          // 태그 섹션 렌더링
          this.renderTagSection(tagCode, visibleMemos, sectionStartIndex);
        }
      }
    });
    
    // 페이지네이션 UI 업데이트
    this.updatePagination();
  }
  
  /**
   * 태그 섹션 렌더링
   * @param {string} tagCode - 태그 코드
   * @param {Array} memos - 해당 태그의 메모 배열 (이미 시간순으로 정렬됨)
   * @param {number} startIndex - 전체 메모 배열에서의 시작 인덱스
   */
  renderTagSection(tagCode, memos, startIndex) {
    if (!memos || memos.length === 0) return;
    
    // 태그 라벨 가져오기
    const tagLabel = MemoCard.getTagLabel(tagCode);
    
    // 태그 섹션 HTML 생성
    const sectionHtml = `
      <div class="memo-tag-section" data-tag-code="${this.escapeHtml(tagCode)}" data-start-index="${startIndex}">
        <div class="memo-tag-section-header">
          <h3 class="memo-tag-section-title">${this.escapeHtml(tagLabel)}</h3>
        </div>
        <div class="memo-tag-section-grid">
          ${memos.map(memo => MemoCard.render(memo)).join('')}
        </div>
      </div>
    `;
    
    const sectionElement = document.createRange().createContextualFragment(sectionHtml);
    this.memoList.appendChild(sectionElement.firstElementChild);
  }

  /**
   * 인라인 캘린더 토글
   */
  async toggleInlineCalendar() {
    this.isCalendarVisible = !this.isCalendarVisible;
    
    if (this.inlineCalendarSection) {
      this.inlineCalendarSection.style.display = this.isCalendarVisible ? 'block' : 'none';
    }
    
    if (this.isCalendarVisible) {
      // 캘린더 표시 시 현재 년/월로 초기화
      this.calendarYear = new Date().getFullYear();
      this.calendarMonth = new Date().getMonth() + 1;
      await this.renderInlineCalendar();
    }
  }

  /**
   * 인라인 캘린더 렌더링
   */
  async renderInlineCalendar() {
    if (!this.inlineCalendarContainer) return;

    // 메모 작성 날짜 목록 로드
    await this.loadCalendarMemoDates();

    // 캘린더 HTML 생성
    const calendarHtml = this.generateCalendarHtml();
    this.inlineCalendarContainer.innerHTML = calendarHtml;
  }

  /**
   * 캘린더 메모 작성 날짜 목록 로드
   */
  async loadCalendarMemoDates() {
    try {
      this.calendarMemoDates = await memoService.getMemoDates(this.calendarYear, this.calendarMonth);
    } catch (error) {
      console.error('메모 작성 날짜 목록 로드 오류:', error);
      this.calendarMemoDates = [];
    }
  }

  /**
   * 캘린더 HTML 생성
   * @returns {string} HTML 문자열
   */
  generateCalendarHtml() {
    const firstDay = new Date(this.calendarYear, this.calendarMonth - 1, 1);
    const lastDay = new Date(this.calendarYear, this.calendarMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    let html = `
      <div class="calendar-header">
        <button class="calendar-nav-btn prev">‹</button>
        <div class="calendar-month-year">${this.calendarYear}년 ${monthNames[this.calendarMonth - 1]}</div>
        <button class="calendar-nav-btn next">›</button>
      </div>
      <div class="calendar-grid">
    `;

    // 요일 헤더
    dayNames.forEach(day => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });

    // 빈 칸 (첫 날 이전)
    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="calendar-day other-month"></div>';
    }

    // 날짜 셀
    const today = new Date();
    const currentDateStr = this.currentDate;
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.calendarYear}-${String(this.calendarMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = today.getFullYear() === this.calendarYear &&
                     today.getMonth() + 1 === this.calendarMonth &&
                     today.getDate() === day;
      const hasMemo = this.calendarMemoDates.includes(dateStr);
      const isSelected = dateStr === currentDateStr;
      
      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (hasMemo) classes += ' has-memo';
      if (isSelected) classes += ' selected';
      
      html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
    }

    // 빈 칸 (마지막 날 이후)
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
      for (let i = 0; i < remainingCells; i++) {
        html += '<div class="calendar-day other-month"></div>';
      }
    }

    html += '</div>';
    return html;
  }

  /**
   * 캘린더 월 이동
   * @param {number} delta - 이동할 월 수 (-1: 이전 달, 1: 다음 달)
   */
  async navigateCalendarMonth(delta) {
    this.calendarMonth += delta;
    if (this.calendarMonth < 1) {
      this.calendarMonth = 12;
      this.calendarYear--;
    } else if (this.calendarMonth > 12) {
      this.calendarMonth = 1;
      this.calendarYear++;
    }
    await this.renderInlineCalendar();
  }

  /**
   * 캘린더 날짜 클릭 처리
   * @param {string} date - 선택된 날짜 (YYYY-MM-DD)
   */
  async handleCalendarDateClick(date) {
    const hasMemo = this.calendarMemoDates.includes(date);
    
    if (hasMemo) {
      // 메모가 있는 날짜: 해당 날짜의 메모 로드
      await this.loadMemoFlow(date);
      // 캘린더 다시 렌더링하여 선택 상태 업데이트
      await this.renderInlineCalendar();
    } else {
      // 메모가 없는 날짜: 안내 메시지
      alert('해당 날짜에 작성된 메모가 없습니다.');
    }
  }

  /**
   * 그룹화 방식 변경
   * @param {string} grouping - 그룹화 방식 (SESSION, BOOK, TAG)
   */
  handleGroupingChange(grouping) {
    this.currentGrouping = grouping;
    // 그룹화 방식 변경 시 첫 페이지로 리셋
    this.currentPage = 1;
    
    // 그룹화 버튼 활성화 상태 업데이트
    if (this.groupingToggle) {
      this.groupingToggle.querySelectorAll('.grouping-btn').forEach((btn) => {
        if (btn.dataset.grouping === grouping) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }
    
    // TAG 모드일 때만 태그 대분류 섹션 표시 (SESSION 모드에서는 숨김)
    if (grouping === 'TAG') {
      if (this.tagCategorySection) {
        this.tagCategorySection.style.display = 'block';
      }
    } else {
      if (this.tagCategorySection) {
        this.tagCategorySection.style.display = 'none';
      }
    }
    
    // 메모 다시 로드
    this.loadMemoFlow();
  }

  /**
   * 태그 대분류 변경
   * @param {string} category - 태그 대분류 (TYPE, TOPIC)
   */
  handleTagCategoryChange(category) {
    this.currentTagCategory = category;
    // 태그 대분류 변경 시 첫 페이지로 리셋
    this.currentPage = 1;
    
    // 태그 대분류 Tab 활성화 상태 업데이트
    if (this.tagCategoryToggle) {
      this.tagCategoryToggle.querySelectorAll('.tag-category-tab').forEach((tab) => {
        if (tab.dataset.category === category) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }
    
    // 메모 다시 로드
    this.loadMemoFlow();
  }

  /**
   * 책 선택 모달 표시
   */
  async showBookSelector() {
    if (!this.bookSelector) return;
    
    this.bookSelector.show((book) => {
      this.handleBookSelect(book);
    });
  }

  /**
   * 책 선택 처리
   * @param {Object} book - 선택된 책 정보
   * 메모 작성은 항상 오늘 날짜에서만 가능하므로, 오늘 날짜로 전환 후 책 선택
   */
  async handleBookSelect(book) {
    this.selectedBook = book;
    this.selectedBookId = book.userBookId;
    
    // 선택된 책 정보 표시
    if (this.selectedBookInfo) {
      this.selectedBookInfo.style.display = 'block';
    }
    if (this.selectedBookTitle) {
      this.selectedBookTitle.textContent = book.title || '제목 없음';
    }
    if (this.selectedBookAuthor) {
      this.selectedBookAuthor.textContent = book.author || '저자 정보 없음';
    }
    
    // 메모 작성은 항상 오늘 날짜에서만 가능하므로 오늘 날짜로 전환
    const today = new Date().toISOString().split('T')[0];
    if (this.currentDate !== today) {
      this.currentDate = today;
    }
    
    // 메모 목록 다시 로드하여 입력 컴포넌트를 올바른 위치에 배치
    // 새 책 선택 시 마지막 페이지로 이동하여 메모 작성 UI 표시
    this.currentPage = 999; // 마지막 페이지로 이동하도록 표시
    await this.loadMemoFlow();
  }

  /**
   * 메모 저장
   * @param {Object} memoData - 메모 에디터에서 전달된 메모 데이터
   */
  async handleMemoSave(memoData) {
    if (!this.selectedBookId) {
      alert('책을 먼저 선택해주세요.');
      return;
    }
    
    if (!memoData || !memoData.content) {
      alert('메모 내용을 입력해주세요.');
      return;
    }
    
    try {
      // 수정 모드인지 확인
      if (this.editingMemoId) {
        // 메모 수정
        const updateData = {
          content: memoData.content,
          tags: memoData.tags || [],
          tagCategory: memoData.tagCategory || 'TYPE', // 태그 대분류 (기본값: TYPE)
        };
        
        await memoService.updateMemo(this.editingMemoId, updateData);
        
        // 수정 모드 해제
        this.editingMemoId = null;
        
        // 페이지 번호 입력 필드 활성화
        if (this.memoEditor && this.memoEditor.memoPageInput) {
          this.memoEditor.memoPageInput.disabled = false;
          this.memoEditor.memoPageInput.title = '';
        }
        
        // 저장 버튼 텍스트 원래대로 변경
        if (this.memoEditor && this.memoEditor.btnSaveMemo) {
          this.memoEditor.btnSaveMemo.textContent = '저장';
        }
        
        // 입력 필드 초기화
        if (this.memoEditor) {
          this.memoEditor.clear();
        }
        
        // 메모 다시 로드
        await this.loadMemoFlow();
        
        // 메모 수정 완료 후 메모 작성 UI 숨김
        this.hideMemoEditor();
      } else {
        // 메모 작성
        // 날짜 검증: 오늘 날짜인지 확인
        const today = new Date().toISOString().split('T')[0];
        if (this.currentDate !== today) {
          alert('메모는 오늘 날짜에만 작성할 수 있습니다.');
          return;
        }
        
        // pageNumber는 사용자가 입력한 값을 사용
        if (!memoData.pageNumber || memoData.pageNumber < 1) {
          alert('페이지 번호를 입력해주세요. (1 이상의 숫자)');
          return;
        }
        
        const createData = {
          userBookId: this.selectedBookId,
          pageNumber: memoData.pageNumber,
          content: memoData.content,
          tags: memoData.tags || [],
          tagCategory: memoData.tagCategory || 'TYPE', // 태그 대분류 (기본값: TYPE)
          // 한국 시간대 기준으로 ISO 문자열 생성 (타임존 정보 없이)
          memoStartTime: (() => {
            const now = new Date(); // 브라우저가 한국 시간대면 한국 시간
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
          })(),
        };
        
        await memoService.createMemo(createData);
        
        // 입력 필드 초기화 (메모 입력 영역은 계속 표시)
        if (this.memoEditor) {
          this.memoEditor.clear();
        }
        
        // 메모 입력 영역이 계속 표시되도록 확인
        if (this.memoInputContainer) {
          this.memoInputContainer.style.display = 'block';
        }
        
        // 메모 저장 후 마지막 페이지로 이동하기 위해 현재 페이지를 임시로 설정
        // (loadMemoFlow 내부에서 renderMemosByBook이 호출되고, 그 안에서 totalPages가 계산됨)
        // 메모 저장 후에는 항상 마지막 페이지로 이동해야 하므로,
        // loadMemoFlow 호출 전에 currentPage를 큰 값으로 설정하여
        // renderMemosByBook에서 마지막 페이지로 조정되도록 함
        const previousPage = this.currentPage;
        this.currentPage = 999; // 임시로 큰 값 설정
        
        // 메모 다시 로드 (오래된 메모부터 상단에 표시됨)
        await this.loadMemoFlow();
        
        // 입력 컴포넌트를 새로 추가된 메모 아래로 스크롤
        if (this.memoEditor && this.memoEditor.container) {
          setTimeout(() => {
            this.memoEditor.container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }, 100);
        }
      }
    } catch (error) {
      console.error('메모 저장/수정 오류:', error);
      alert('메모 저장/수정 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  }

  /**
   * 메모 작성 취소 처리
   */
  handleMemoCancel() {
    // 입력 필드 초기화 (이미 memo-editor에서 clear 호출됨)
    
    // 수정 모드 해제
    if (this.editingMemoId) {
      this.editingMemoId = null;
      
      // 페이지 번호 입력 필드 활성화
      if (this.memoEditor && this.memoEditor.memoPageInput) {
        this.memoEditor.memoPageInput.disabled = false;
        this.memoEditor.memoPageInput.title = '';
      }
      
      // 저장 버튼 텍스트 원래대로 변경
      if (this.memoEditor && this.memoEditor.btnSaveMemo) {
        this.memoEditor.btnSaveMemo.textContent = '저장';
      }
    }
    
    // 메모 에디터 숨김 처리
    if (this.memoEditor && this.memoEditor.container) {
      const parent = this.memoEditor.container.parentNode;
      
      // 메모 섹션 내부에 있으면 flow-content로 이동하고 숨김
      if (parent && (parent === this.memoList || this.memoList.contains(parent))) {
        if (this.flowContent && this.memoEditor.container.parentNode !== this.flowContent) {
          this.flowContent.appendChild(this.memoEditor.container);
        }
        this.memoEditor.container.style.display = 'none';
      } else {
        // 이미 flow-content에 있으면 그냥 숨김
        this.memoEditor.container.style.display = 'none';
      }
    }
    
    // 입력 컨테이너 숨김
    if (this.memoInputContainer) {
      this.memoInputContainer.style.display = 'none';
    }
  }
  
  /**
   * 메모 수정
   * @param {number} memoId - 메모 ID
   */
  handleMemoEdit(memoId) {
    // 현재 메모 목록에서 메모 찾기
    const memo = this.memos.find(m => m.id === memoId);
    if (!memo) {
      alert('메모를 찾을 수 없습니다.');
      return;
    }
    
    // 수정 모드로 전환
    this.editingMemoId = memoId;
    
    // 선택된 책 정보 설정 (메모가 속한 책)
    if (memo.userBookId) {
      this.selectedBookId = memo.userBookId;
      // 책 정보가 있으면 설정
      if (memo.bookTitle) {
        this.selectedBook = {
          userBookId: memo.userBookId,
          title: memo.bookTitle,
        };
      }
    }
    
    // 메모 에디터에 메모 데이터 설정
    if (this.memoEditor) {
      // 메모 데이터 준비 (태그는 코드 배열로 변환)
      const memoData = {
        pageNumber: memo.pageNumber,
        content: memo.content,
        tags: memo.tags ? memo.tags.map(tag => typeof tag === 'string' ? tag : tag.code) : [],
      };
      
      this.memoEditor.setMemoData(memoData);
      
      // 메모 에디터 표시
      if (this.memoEditor.container) {
        this.memoEditor.container.style.display = 'block';
      }
      if (this.memoInputContainer) {
        this.memoInputContainer.style.display = 'block';
      }
      
      // 페이지 번호 입력 필드 비활성화 (수정 불가)
      if (this.memoEditor.memoPageInput) {
        this.memoEditor.memoPageInput.disabled = true;
        this.memoEditor.memoPageInput.title = '페이지 번호는 수정할 수 없습니다.';
      }
      
      // 저장 버튼 텍스트 변경
      if (this.memoEditor.btnSaveMemo) {
        this.memoEditor.btnSaveMemo.textContent = '수정 완료';
      }
      
      // 메모 에디터로 스크롤
      setTimeout(() => {
        if (this.memoEditor && this.memoEditor.container) {
          this.memoEditor.container.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  }

  /**
   * 메모 삭제
   * @param {number} memoId - 메모 ID
   */
  async handleMemoDelete(memoId) {
    if (!confirm('메모를 삭제하시겠습니까?')) {
      return;
    }
    
    try {
      await memoService.deleteMemo(memoId);
      
      // 메모 다시 로드
      await this.loadMemoFlow();
      
      alert('메모가 삭제되었습니다.');
    } catch (error) {
      console.error('메모 삭제 오류:', error);
      alert('메모 삭제 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  }

  /**
   * 날짜 변경 감지 시작
   */
  startDateChangeDetection() {
    // 1분마다 날짜 확인
    this.dateChangeIntervalId = setInterval(() => {
      const today = new Date().toISOString().split('T')[0];
      if (this.currentDate !== today) {
        // 날짜가 변경되었으면 오늘 날짜로 자동 전환
        this.loadMemoFlow(today);
      }
    }, 60000); // 1분
  }

  /**
   * 로딩 상태 설정
   * @param {boolean} loading - 로딩 여부
   */
  setLoading(loading) {
    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = loading ? 'flex' : 'none';
    }
  }

  /**
   * 빈 상태 표시
   */
  showEmptyState() {
    if (this.emptyState) {
      this.emptyState.style.display = 'block';
    }
    if (this.memoList) {
      this.memoList.style.display = 'none';
    }
  }

  /**
   * 빈 상태 숨김
   */
  hideEmptyState() {
    if (this.emptyState) {
      this.emptyState.style.display = 'none';
    }
    if (this.memoList) {
      this.memoList.style.display = 'grid';
    }
  }
  
  /**
   * 특정 페이지로 이동
   * @param {number} page - 이동할 페이지 번호
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages) {
      return;
    }
    
    this.currentPage = page;
    
    // 메모 다시 로드하여 현재 페이지의 메모만 표시
    this.loadMemoFlow();
  }
  
  /**
   * 페이지네이션 UI 업데이트
   */
  updatePagination() {
    if (!this.memoPagination || !this.btnPrevPage || !this.btnNextPage || !this.paginationInfo) {
      return;
    }
    
    // 메모가 없으면 페이지네이션 숨김
    if (this.memos.length === 0) {
      this.memoPagination.style.display = 'none';
      return;
    }
    
    // 페이지네이션 표시
    this.memoPagination.style.display = 'flex';
    
    // 이전/다음 버튼 활성화 상태 업데이트
    this.btnPrevPage.disabled = this.currentPage <= 1;
    this.btnNextPage.disabled = this.currentPage >= this.totalPages;
    
    // 페이지 정보 업데이트
    this.paginationInfo.textContent = `${this.currentPage} / ${this.totalPages}`;
  }

  /**
   * 컴포넌트 정리 (구독 해제 및 리소스 정리)
   */
  destroy() {
    // 모든 이벤트 구독 해제
    if (this.unsubscribers) {
      this.unsubscribers.forEach(unsubscribe => unsubscribe());
      this.unsubscribers = [];
    }
    
    // 모든 이벤트 리스너 제거
    if (this.eventListeners) {
      this.eventListeners.forEach(({ element, event, handler }) => {
        if (element && handler) {
          element.removeEventListener(event, handler);
        }
      });
      this.eventListeners = [];
    }
    
    // 날짜 변경 감지 인터벌 정리
    if (this.dateChangeIntervalId) {
      clearInterval(this.dateChangeIntervalId);
      this.dateChangeIntervalId = null;
    }
    
    // 컴포넌트 정리
    if (this.bookSelector && typeof this.bookSelector.destroy === 'function') {
      this.bookSelector.destroy();
    }
    if (this.memoEditor && typeof this.memoEditor.destroy === 'function') {
      this.memoEditor.destroy();
    }
    if (this.calendarModal && typeof this.calendarModal.destroy === 'function') {
      this.calendarModal.destroy();
    }
    
    // 참조 정리
    this.handleCalendarClick = null;
    this.handleInlineCalendarClick = null;
    this.handleGroupingToggleClick = null;
    this.handleTagCategoryToggleClick = null;
    this.handleSelectBookClick = null;
    this.handleHomeClick = null;
    this.handleMemoListClick = null;
  }

  /**
   * 책 덮기 버튼 클릭 처리
   */
  handleCloseBookClick = () => {
    if (!this.selectedBook || !this.selectedBookId) {
      alert('책을 먼저 선택해주세요.');
      return;
    }
    
    // 메모 작성 UI 강제로 숨김
    this.hideMemoEditor();
    
    this.showCloseBookModal();
  }

  /**
   * 책 덮기 모달 표시
   */
  showCloseBookModal() {
    if (!this.closeBookModal || !this.selectedBook) return;
    
    // 현재 읽은 페이지 수와 전체 페이지 수 설정
    if (this.closeBookProgress) {
      this.closeBookProgress.value = this.selectedBook.readingProgress || '';
    }
    
    if (this.closeBookTotalPages) {
      const totalPages = this.selectedBook.totalPages || 0;
      this.closeBookTotalPages.textContent = totalPages > 0 
        ? `전체 페이지: ${totalPages}페이지` 
        : '';
    }
    
    // Finished 필드 초기화 및 숨김
    if (this.closeBookFinishedFields) {
      this.closeBookFinishedFields.style.display = 'none';
    }
    if (this.closeBookFinishedDate) {
      this.closeBookFinishedDate.value = '';
    }
    if (this.closeBookRating) {
      this.closeBookRating.value = '0';
    }
    if (this.closeBookRatingStars) {
      this.closeBookRatingStars.setAttribute('data-rating', '0');
      this.closeBookRatingStars.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active');
      });
    }
    if (this.closeBookReview) {
      this.closeBookReview.value = '';
    }
    
    // 별점 입력 초기화
    if (this.closeBookRatingStars) {
      this.initRatingStarsInput(this.closeBookRatingStars, this.closeBookRating);
    }
    
    // 모달 표시 (modal-overlay로 감싸져 있으므로 flex로 표시하고 show 클래스 추가)
    this.closeBookModal.style.display = 'flex';
    this.closeBookModal.classList.add('show');
    
    // 진행률 변경 감지하여 Finished 필드 표시/숨김
    if (this.closeBookProgress) {
      this.closeBookProgress.addEventListener('input', this.handleCloseBookProgressChange);
    }
  }

  /**
   * 책 덮기 모달 숨김
   */
  hideCloseBookModal() {
    if (!this.closeBookModal) return;
    
    this.closeBookModal.classList.remove('show');
    this.closeBookModal.style.display = 'none';
    
    // 입력 필드 초기화
    if (this.closeBookProgress) {
      this.closeBookProgress.value = '';
      this.closeBookProgress.removeEventListener('input', this.handleCloseBookProgressChange);
    }
    if (this.closeBookFinishedFields) {
      this.closeBookFinishedFields.style.display = 'none';
    }
    if (this.closeBookFinishedDate) {
      this.closeBookFinishedDate.value = '';
    }
    if (this.closeBookRating) {
      this.closeBookRating.value = '0';
    }
    if (this.closeBookReview) {
      this.closeBookReview.value = '';
    }
  }

  /**
   * 책 덮기 진행률 변경 처리 (Finished 필드 표시/숨김)
   */
  handleCloseBookProgressChange = () => {
    if (!this.closeBookProgress || !this.closeBookFinishedFields || !this.selectedBook) return;
    
    const lastReadPage = parseInt(this.closeBookProgress.value) || 0;
    const totalPages = this.selectedBook.totalPages || 0;
    
    // 진행률이 100%인 경우 Finished 필드 표시
    if (totalPages > 0 && lastReadPage >= totalPages) {
      this.closeBookFinishedFields.style.display = 'block';
      
      // 독서 종료일 기본값을 오늘 날짜로 설정
      if (this.closeBookFinishedDate) {
        const today = new Date().toISOString().split('T')[0];
        this.closeBookFinishedDate.value = today;
      }
      
      // 필수 필드 검증 활성화
      if (this.closeBookFinishedDate) {
        this.closeBookFinishedDate.required = true;
      }
      if (this.closeBookRating) {
        this.closeBookRating.required = true;
      }
    } else {
      this.closeBookFinishedFields.style.display = 'none';
      
      // 필수 필드 검증 비활성화
      if (this.closeBookFinishedDate) {
        this.closeBookFinishedDate.required = false;
      }
      if (this.closeBookRating) {
        this.closeBookRating.required = false;
      }
    }
  }

  /**
   * 별점 입력 초기화
   */
  initRatingStarsInput(starsContainer, hiddenInput) {
    if (!starsContainer || !hiddenInput) return;
    
    // 기존 이벤트 리스너 제거 (중복 방지)
    const existingHandler = starsContainer._ratingHandler;
    if (existingHandler) {
      starsContainer.removeEventListener('click', existingHandler);
      starsContainer.removeEventListener('mouseleave', existingHandler);
    }
    
    let currentRating = parseInt(starsContainer.getAttribute('data-rating')) || 0;
    
    // 클릭 이벤트 핸들러
    const handleStarClick = (e) => {
      const star = e.target.closest('.star');
      if (!star) return;
      
      const value = parseInt(star.getAttribute('data-value'), 10);
      if (isNaN(value) || value < 1 || value > 5) return;
      
      currentRating = value;
      hiddenInput.value = currentRating;
      starsContainer.setAttribute('data-rating', currentRating);
      this.updateRatingStars(starsContainer, currentRating);
    };
    
    // 마우스 오버 이벤트 (호버 효과)
    const handleStarHover = (e) => {
      const star = e.target.closest('.star');
      if (!star) {
        // 마우스가 별 영역을 벗어나면 현재 선택된 평점으로 복원
        this.updateRatingStars(starsContainer, currentRating);
        return;
      }
      
      const value = parseInt(star.getAttribute('data-value'), 10);
      if (isNaN(value) || value < 1 || value > 5) return;
      
      // 호버 시 미리보기 (실제 선택은 아님)
      this.updateRatingStars(starsContainer, value);
    };
    
    // 마우스 리브 이벤트
    const handleMouseLeave = () => {
      this.updateRatingStars(starsContainer, currentRating);
    };
    
    // 이벤트 리스너 등록
    starsContainer.addEventListener('click', handleStarClick);
    starsContainer.addEventListener('mouseover', handleStarHover);
    starsContainer.addEventListener('mouseleave', handleMouseLeave);
    
    // 참조 저장 (나중에 제거하기 위해)
    starsContainer._ratingHandler = handleStarClick;
    
    // 초기 별점 표시
    this.updateRatingStars(starsContainer, currentRating);
  }

  /**
   * 별점 업데이트
   */
  updateRatingStars(starsContainer, rating) {
    const stars = starsContainer.querySelectorAll('.star');
    stars.forEach((star) => {
      const value = parseInt(star.getAttribute('data-value'), 10);
      if (value <= rating) {
        star.classList.add('active');
        star.textContent = '★';
      } else {
        star.classList.remove('active');
        star.textContent = '☆';
      }
    });
  }

  /**
   * 책 덮기 확인 처리
   */
  handleCloseBookConfirm = async () => {
    if (!this.selectedBook || !this.selectedBookId) {
      alert('책을 먼저 선택해주세요.');
      return;
    }
    
    // 입력값 검증
    const lastReadPage = parseInt(this.closeBookProgress?.value) || 0;
    if (lastReadPage < 1) {
      alert('현재 읽은 페이지 수를 입력해주세요.');
      return;
    }
    
    const totalPages = this.selectedBook.totalPages || 0;
    if (totalPages > 0 && lastReadPage > totalPages) {
      alert(`페이지 수는 전체 페이지 수(${totalPages}페이지)를 초과할 수 없습니다.`);
      return;
    }
    
    // 진행률이 100%인 경우 Finished 필드 검증
    const isFinished = totalPages > 0 && lastReadPage >= totalPages;
    if (isFinished) {
      const finishedDate = this.closeBookFinishedDate?.value;
      if (!finishedDate) {
        alert('독서 종료일을 입력해주세요.');
        return;
      }
      
      const rating = parseInt(this.closeBookRating?.value) || 0;
      if (rating < 1 || rating > 5) {
        alert('평점을 선택해주세요. (1~5점)');
        return;
      }
    }
    
    try {
      // API 호출 데이터 준비
      const requestData = {
        lastReadPage: lastReadPage
      };
      
      // Finished 카테고리로 변경될 경우 추가 필드 포함
      if (isFinished) {
        requestData.readingFinishedDate = this.closeBookFinishedDate?.value;
        requestData.rating = parseInt(this.closeBookRating?.value) || 0;
        requestData.review = this.closeBookReview?.value || null;
      }
      
      // API 호출
      await memoService.closeBook(this.selectedBookId, requestData);
      
      // 성공 메시지
      alert('책 덮기가 완료되었습니다.');
      
      // 모달 닫기
      this.hideCloseBookModal();
      
      // 선택된 책 초기화
      this.selectedBook = null;
      this.selectedBookId = null;
      
      // 선택된 책 정보 숨김
      if (this.selectedBookInfo) {
        this.selectedBookInfo.style.display = 'none';
      }
      
      // 메모 에디터 숨김
      this.hideMemoEditor();
      
      // 메모 목록 다시 로드
      await this.loadMemoFlow();
      
    } catch (error) {
      console.error('책 덮기 오류:', error);
      alert('책 덮기 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new FlowView();
});

export default FlowView;

