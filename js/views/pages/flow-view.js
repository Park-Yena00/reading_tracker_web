/**
 * 오늘의 흐름 페이지 뷰
 * 바인더 노트 형식의 메모 작성 및 관리 화면
 */

import memoService from '../../services/memo-service.js';
import bookService from '../../services/book-service.js';
import authHelper from '../../utils/auth-helper.js';
import { MemoCard } from '../../components/memo-card.js';
import CalendarModal from '../../components/calendar-modal.js';
import BookSelector from '../../components/book-selector.js';
import MemoEditor from '../../components/memo-editor.js';
import HeaderView from '../common/header.js';
import FooterView from '../common/footer.js';
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
    
    // 상태
    this.currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.currentGrouping = 'SESSION'; // SESSION, BOOK, TAG
    this.currentTagCategory = 'TYPE'; // TYPE, TOPIC
    this.selectedBookId = null; // 선택된 책의 userBookId
    this.selectedBook = null; // 선택된 책 정보
    this.memos = []; // 현재 표시 중인 메모 목록
    this.isCalendarVisible = false; // 인라인 캘린더 표시 여부
    this.calendarYear = new Date().getFullYear();
    this.calendarMonth = new Date().getMonth() + 1; // 1-12
    this.calendarMemoDates = []; // 메모가 작성된 날짜 목록
    
    // 컴포넌트
    this.calendarModal = null;
    this.bookSelector = null;
    this.memoEditor = null;
    
    // 이벤트 구독 관리
    this.unsubscribers = [];
    
    // 날짜 변경 감지 인터벌 ID
    this.dateChangeIntervalId = null;
    
    // 보호된 페이지: 인증 확인
    if (!authHelper.checkAuth()) {
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
    this.tagCategoryToggle = document.getElementById('tag-category-toggle');
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
    this.emptyState = document.getElementById('empty-state');
    
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
      this.btnCalendar.addEventListener('click', () => {
        this.toggleInlineCalendar();
      });
    }
    
    // 인라인 캘린더 이벤트 위임
    if (this.inlineCalendarContainer) {
      this.inlineCalendarContainer.addEventListener('click', (e) => {
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
      });
    }
    
    // 그룹화 선택
    if (this.groupingToggle) {
      this.groupingToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.grouping-btn');
        if (btn) {
          const grouping = btn.dataset.grouping;
          this.handleGroupingChange(grouping);
        }
      });
    }
    
    // 태그 대분류 선택
    if (this.tagCategoryToggle) {
      this.tagCategoryToggle.addEventListener('click', (e) => {
        const btn = e.target.closest('.tag-category-btn');
        if (btn) {
          const category = btn.dataset.category;
          this.handleTagCategoryChange(category);
          // 메모 에디터의 태그 대분류도 업데이트
          if (this.memoEditor) {
            this.memoEditor.setTagCategory(category);
          }
        }
      });
    }
    
    // 책 선택 버튼
    if (this.btnSelectBook) {
      this.btnSelectBook.addEventListener('click', () => {
        this.showBookSelector();
      });
    }
    
    // 메모 저장은 memo-editor 컴포넌트에서 처리
    
    // 홈으로 버튼
    const btnHome = document.getElementById('btn-home');
    if (btnHome) {
      btnHome.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = ROUTES.HOME;
      });
    }
    
    // 메모 카드 이벤트 위임 (수정/삭제)
    if (this.memoList) {
      this.memoList.addEventListener('click', (e) => {
        const editBtn = e.target.closest('.memo-edit-btn');
        const deleteBtn = e.target.closest('.memo-delete-btn');
        
        if (editBtn) {
          const memoId = parseInt(editBtn.dataset.memoId);
          this.handleMemoEdit(memoId);
        } else if (deleteBtn) {
          const memoId = parseInt(deleteBtn.dataset.memoId);
          this.handleMemoDelete(memoId);
        }
      });
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
        console.log('메모가 없거나 접근 권한이 없습니다. 빈 상태를 표시합니다.');
        this.showEmptyState();
        // 메모 작성 UI 활성화 (책 선택 버튼 표시)
        if (this.memoInputContainer) {
          this.memoInputContainer.style.display = 'none';
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
    
    this.memoList.innerHTML = '';
    
    console.log('[FlowView] renderMemos 호출, response:', response);
    
    // api-client.js가 이미 response.data를 반환하므로 response 자체가 data임
    if (!response) {
      console.log('[FlowView] response가 없습니다.');
      this.showEmptyState();
      return;
    }
    
    // response가 이미 data 부분이므로 직접 사용
    const { memosByBook, memosByTag, totalMemoCount } = response;
    
    console.log('[FlowView] 메모 데이터:', { memosByBook, memosByTag, totalMemoCount, currentGrouping: this.currentGrouping });
    
    if (totalMemoCount === 0) {
      console.log('[FlowView] 메모가 없습니다.');
      this.showEmptyState();
      return;
    }
    
    // 그룹화 방식에 따라 렌더링
    if (this.currentGrouping === 'TAG' && memosByTag) {
      console.log('[FlowView] 태그별 렌더링');
      this.renderMemosByTag(memosByTag);
    } else if (memosByBook) {
      console.log('[FlowView] 책별 렌더링');
      this.renderMemosByBook(memosByBook);
    } else {
      console.warn('[FlowView] 렌더링할 메모 데이터가 없습니다.');
    }
    
    this.hideEmptyState();
  }

  /**
   * 책별 메모 렌더링
   * @param {Object} memosByBook - 책별 메모 그룹
   */
  renderMemosByBook(memosByBook) {
    // TODO: 세션 그룹화 로직 구현 필요
    // 현재는 간단하게 모든 메모를 시간 순으로 표시 (오래된 메모부터 상단에)
    const allMemos = [];
    
    Object.values(memosByBook).forEach((bookGroup) => {
      if (bookGroup.memos && Array.isArray(bookGroup.memos)) {
        allMemos.push(...bookGroup.memos);
      }
    });
    
    console.log('[FlowView] 책별 메모 수:', allMemos.length);
    
    // 시간 순 정렬 (오래된 메모부터 상단에)
    allMemos.sort((a, b) => {
      const timeA = new Date(a.memoStartTime || a.createdAt);
      const timeB = new Date(b.memoStartTime || b.createdAt);
      return timeA - timeB; // 시간 순 정렬
    });
    
    // 메모 카드 렌더링
    allMemos.forEach((memo) => {
      const cardHtml = MemoCard.render(memo);
      const cardElement = document.createRange().createContextualFragment(cardHtml);
      this.memoList.appendChild(cardElement);
    });
    
    console.log('[FlowView] 렌더링된 메모 카드 수:', this.memoList.children.length);
    
    this.memos = allMemos;
  }

  /**
   * 태그별 메모 렌더링
   * @param {Object} memosByTag - 태그별 메모 그룹
   */
  renderMemosByTag(memosByTag) {
    // TODO: 태그별 그룹화 로직 구현 필요
    // 현재는 간단하게 모든 메모를 시간 순으로 표시 (오래된 메모부터 상단에)
    const allMemos = [];
    
    Object.values(memosByTag).forEach((tagGroup) => {
      if (tagGroup.memosByBook) {
        Object.values(tagGroup.memosByBook).forEach((bookGroup) => {
          if (bookGroup.memos && Array.isArray(bookGroup.memos)) {
            allMemos.push(...bookGroup.memos);
          }
        });
      }
    });
    
    console.log('[FlowView] 태그별 메모 수:', allMemos.length);
    
    // 시간 순 정렬 (오래된 메모부터 상단에)
    allMemos.sort((a, b) => {
      const timeA = new Date(a.memoStartTime || a.createdAt);
      const timeB = new Date(b.memoStartTime || b.createdAt);
      return timeA - timeB; // 시간 순 정렬
    });
    
    // 메모 카드 렌더링
    allMemos.forEach((memo) => {
      const cardHtml = MemoCard.render(memo);
      const cardElement = document.createRange().createContextualFragment(cardHtml);
      this.memoList.appendChild(cardElement);
    });
    
    console.log('[FlowView] 렌더링된 메모 카드 수:', this.memoList.children.length);
    
    this.memos = allMemos;
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
    
    // 태그 대분류 버튼 활성화 상태 업데이트
    if (this.tagCategoryToggle) {
      this.tagCategoryToggle.querySelectorAll('.tag-category-btn').forEach((btn) => {
        if (btn.dataset.category === category) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
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
   */
  handleBookSelect(book) {
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
    
    // 메모 입력 영역 활성화
    if (this.memoInputContainer) {
      this.memoInputContainer.style.display = 'block';
    }
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
    
    // 날짜 검증: 오늘 날짜인지 확인
    const today = new Date().toISOString().split('T')[0];
    if (this.currentDate !== today) {
      alert('메모는 오늘 날짜에만 작성할 수 있습니다.');
      return;
    }
    
    try {
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
        memoStartTime: new Date().toISOString(),
      };
      
      console.log('[FlowView] 메모 저장 데이터:', createData);
      
      await memoService.createMemo(createData);
      
      // 입력 필드 초기화 (메모 입력 영역은 계속 표시)
      if (this.memoEditor) {
        this.memoEditor.clear();
      }
      
      // 메모 입력 영역이 계속 표시되도록 확인
      if (this.memoInputContainer) {
        this.memoInputContainer.style.display = 'block';
      }
      
      // 메모 다시 로드 (오래된 메모부터 상단에 표시됨)
      await this.loadMemoFlow();
      
      // 메모 입력 영역으로 스크롤 (새로운 메모 입력을 위해)
      if (this.memoInputContainer) {
        // 약간의 지연을 두어 DOM 업데이트 후 스크롤
        setTimeout(() => {
          this.memoInputContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
      
      // 간단한 성공 메시지 (선택사항 - 필요시 주석 해제)
      // alert('메모가 저장되었습니다.');
    } catch (error) {
      console.error('메모 저장 오류:', error);
      alert('메모 저장 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  }

  /**
   * 메모 수정
   * @param {number} memoId - 메모 ID
   */
  handleMemoEdit(memoId) {
    // TODO: 메모 수정 기능 구현
    alert('메모 수정 기능은 아직 구현 중입니다.');
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
   * 컴포넌트 정리 (구독 해제 및 리소스 정리)
   */
  destroy() {
    // 모든 이벤트 구독 해제
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    
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
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new FlowView();
});

export default FlowView;

