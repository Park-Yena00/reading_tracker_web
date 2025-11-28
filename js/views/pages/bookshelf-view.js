/**
 * 서재 페이지 뷰
 * 서재 목록 조회, 필터링, 정렬, 상태 변경, 삭제 등의 기능 제공
 */

import bookService from '../../services/book-service.js';
import authHelper from '../../utils/auth-helper.js';
import { BookshelfBookCard } from '../../components/bookshelf-book-card.js';
import bookState from '../../state/book-state.js';
import { BOOK_EVENTS } from '../../constants/events.js';
import eventBus from '../../utils/event-bus.js';
import { ROUTES } from '../../constants/routes.js';
import HeaderView from '../common/header.js';
import FooterView from '../common/footer.js';
import Modal from '../common/modal.js';

class BookshelfView {
  constructor() {
    this.bookshelfList = null;
    this.loadingSpinner = null;
    this.emptyState = null;
    this.categorySidebar = null;
    
    // 필터/정렬 상태
    this.currentCategory = null; // 선택된 카테고리 (null이면 첫 번째 카테고리)
    this.currentSortBy = 'TITLE';
    
    // 전체 도서 목록 (필터링 전)
    this.allBooks = [];
    
    // 사용 가능한 카테고리 목록
    this.availableCategories = [];
    
    // 모달 인스턴스
    this.modal = null;
    
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
    this.bookshelfList = document.getElementById('bookshelf-list');
    this.loadingSpinner = document.getElementById('loading-spinner');
    this.emptyState = document.getElementById('empty-state');
    this.categorySidebar = document.getElementById('category-sidebar');
    
    if (!this.bookshelfList) {
      console.error('Bookshelf list not found');
      return;
    }
    
    // 뒤로가기 버튼 이벤트 리스너 (즉시 등록)
    this.setupBackButton();
    
    // 메뉴 버튼 클릭 이벤트 위임
    this.bookshelfList.addEventListener('click', (e) => {
      const menuBtn = e.target.closest('.btn-menu');
      if (menuBtn) {
        e.stopPropagation();
        const userBookId = menuBtn.dataset.userBookId;
        this.toggleMenu(userBookId);
        return;
      }
      
      // 메뉴 외부 클릭 시 모든 메뉴 닫기
      if (!e.target.closest('.book-menu-dropdown')) {
        this.closeAllMenus();
      }
      
      // 상태 변경 버튼
      if (e.target.dataset.action === 'change-status') {
        e.preventDefault();
        e.stopPropagation();
        const userBookId = parseInt(e.target.dataset.userBookId);
        this.handleChangeStatus(userBookId);
        this.closeAllMenus();
      }
      
      // 삭제 버튼
      if (e.target.dataset.action === 'delete') {
        e.preventDefault();
        e.stopPropagation();
        const userBookId = parseInt(e.target.dataset.userBookId);
        this.handleDelete(userBookId);
        this.closeAllMenus();
      }
    });
    
    // 초기 서재 로드
    this.loadBookshelf();
    
    // 서재 업데이트 이벤트 구독
    this.unsubscribers = [];
    const unsubscribeBookshelfUpdated = eventBus.subscribe(BOOK_EVENTS.BOOKSHELF_UPDATED, () => {
      this.loadBookshelf();
    });
    this.unsubscribers.push(unsubscribeBookshelfUpdated);
  }

  /**
   * 서재 로드 (카테고리 목록 추출 및 첫 번째 카테고리 선택)
   */
  async loadBookshelf() {
    this.setLoading(true);
    this.hideEmptyState();
    
    try {
      // 전체 서재 조회 (카테고리 목록 추출용)
      const response = await bookService.getBookshelf({
        sortBy: this.currentSortBy,
      });
      
      this.allBooks = response.books || [];
      
      // 카테고리 목록 추출 (항상 모든 카테고리 표시)
      this.extractCategories();
      
      // 카테고리 책갈피 렌더링
      this.renderCategorySidebar();
      
      // 첫 번째 카테고리를 기본값으로 선택하고 해당 카테고리의 책들만 로드
      if (this.availableCategories.length > 0) {
        if (this.currentCategory === null) {
          this.currentCategory = this.availableCategories[0];
        }
        await this.loadBooksByCategory(this.currentCategory);
      } else {
        // 카테고리가 없으면 빈 상태 표시 (이론적으로 발생하지 않음)
        this.showEmptyState(null);
      }
    } catch (error) {
      console.error('서재 로드 오류:', error);
      alert('서재를 불러오는 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
      this.showEmptyState(null);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 카테고리 목록 추출 (항상 모든 카테고리 표시)
   * 서재에 책이 있든 없든 항상 모든 카테고리 책갈피를 표시
   */
  extractCategories() {
    // 항상 모든 카테고리를 표시 (서재에 책이 없어도)
    // 카테고리 순서 정의 (ToRead, Reading, AlmostFinished, Finished)
    this.availableCategories = ['ToRead', 'Reading', 'AlmostFinished', 'Finished'];
  }

  /**
   * 카테고리 책갈피 렌더링
   */
  renderCategorySidebar() {
    if (!this.categorySidebar) return;
    
    this.categorySidebar.innerHTML = '';
    
    this.availableCategories.forEach((category) => {
      const tab = document.createElement('button');
      tab.className = 'category-tab';
      if (category === this.currentCategory) {
        tab.classList.add('active');
      }
      tab.textContent = this.getCategoryLabel(category);
      tab.dataset.category = category;
      tab.addEventListener('click', () => {
        this.handleCategorySelect(category);
      });
      
      this.categorySidebar.appendChild(tab);
    });
  }

  /**
   * 카테고리 라벨 반환
   * @param {string} category - 카테고리 코드
   * @returns {string} 카테고리 라벨
   */
  getCategoryLabel(category) {
    const labels = {
      'ToRead': '읽을 예정',
      'Reading': '읽는 중',
      'AlmostFinished': '거의 다 읽음',
      'Finished': '완독',
    };
    return labels[category] || category;
  }

  /**
   * 카테고리 선택 처리
   * @param {string} category - 선택된 카테고리
   */
  handleCategorySelect(category) {
    this.currentCategory = category;
    
    // 카테고리 탭 활성화 상태 업데이트
    this.categorySidebar.querySelectorAll('.category-tab').forEach((tab) => {
      if (tab.dataset.category === category) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
    
    // 선택된 카테고리의 책들만 로드
    this.loadBooksByCategory(category);
  }

  /**
   * 카테고리별 도서 목록 로드
   * @param {string} category - 카테고리 코드
   */
  async loadBooksByCategory(category) {
    this.setLoading(true);
    this.hideEmptyState();
    
    try {
      const response = await bookService.getBookshelf({
        category: category,
        sortBy: this.currentSortBy,
      });
      
      const books = response.books || [];
      this.displayBookshelf(books);
    } catch (error) {
      console.error('카테고리별 도서 로드 오류:', error);
      // 에러 발생 시에도 빈 공간만 표시 (안내문구 없음)
      this.displayBookshelf([]);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 서재 목록 표시
   * @param {Array} books - 도서 목록
   */
  displayBookshelf(books) {
    if (!this.bookshelfList) return;
    
    // API에서 이미 카테고리별로 필터링된 결과를 받으므로 추가 필터링 불필요
    this.bookshelfList.innerHTML = '';
    
    // 책이 있으면 표시, 없으면 빈 공간만 표시 (안내문구 없음)
    if (books && books.length > 0) {
      books.forEach((book) => {
        const cardHtml = BookshelfBookCard.render(book);
        const cardElement = document.createRange().createContextualFragment(cardHtml);
        this.bookshelfList.appendChild(cardElement);
      });
    }
    
    // 빈 상태 메시지는 표시하지 않음 (빈 공간만 표시)
    this.hideEmptyState();
  }


  /**
   * 메뉴 토글
   * @param {string} userBookId - 사용자 도서 ID
   */
  toggleMenu(userBookId) {
    this.closeAllMenus();
    const menu = document.getElementById(`menu-${userBookId}`);
    if (menu) {
      menu.classList.add('active');
    }
  }

  /**
   * 모든 메뉴 닫기
   */
  closeAllMenus() {
    document.querySelectorAll('.book-menu-dropdown').forEach((menu) => {
      menu.classList.remove('active');
    });
  }

  /**
   * 상태 변경 처리
   * @param {number} userBookId - 사용자 도서 ID
   */
  async handleChangeStatus(userBookId) {
    const book = this.allBooks.find(b => b.userBookId === userBookId);
    if (!book) return;
    
    const categories = [
      { value: 'ToRead', label: '읽고 싶은 책' },
      { value: 'Reading', label: '읽는 중' },
      { value: 'AlmostFinished', label: '거의 다 읽음' },
      { value: 'Finished', label: '읽은 책' },
    ];
    
    // 현재 상태 제외
    const availableCategories = categories.filter(c => c.value !== book.category);
    
    // 간단한 선택 UI (prompt 사용)
    const options = availableCategories.map((c, idx) => `${idx + 1}. ${c.label}`).join('\n');
    const choice = prompt(`상태를 변경하세요:\n${options}\n\n번호를 입력하세요:`, '1');
    
    if (!choice || isNaN(choice)) return;
    
    const choiceIndex = parseInt(choice) - 1;
    if (choiceIndex < 0 || choiceIndex >= availableCategories.length) {
      alert('잘못된 선택입니다.');
      return;
    }
    
    const selectedCategory = availableCategories[choiceIndex].value;
    
    try {
      await bookService.updateBookStatus(userBookId, selectedCategory);
      
      // 성공 메시지
      alert('도서 상태가 변경되었습니다.');
      
      // 전체 서재 다시 로드 (카테고리 목록이 변경될 수 있음)
      await this.loadBookshelf();
      
      // 상태 업데이트
      bookState.updateBookStatus(userBookId, { category: selectedCategory });
      
    } catch (error) {
      console.error('상태 변경 오류:', error);
      alert('상태 변경 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  }

  /**
   * 삭제 처리
   * @param {number} userBookId - 사용자 도서 ID
   */
  async handleDelete(userBookId) {
    const book = this.allBooks.find(b => b.userBookId === userBookId);
    if (!book) return;
    
    // 확인 모달 (재사용)
    if (!this.modal) {
      this.modal = new Modal({
        title: '',
        content: '',
        closeOnOverlayClick: false,
        closeOnEscape: true,
        showCloseButton: true,
      });
    }
    
    // 삭제 확인 메시지 (메모 삭제 경고 포함)
    const deleteMessage = `
      <div style="line-height: 1.6;">
        <p style="margin-bottom: var(--spacing-md);">
          <strong>"${this.escapeHtml(book.title)}"</strong>을(를) 서재에서 삭제하시겠습니까?
        </p>
        <p style="color: var(--color-error); font-weight: var(--font-weight-semibold); margin-bottom: var(--spacing-sm);">
          ⚠️ 경고: 이 책에 작성된 모든 메모도 함께 삭제됩니다.
        </p>
        <p style="color: var(--color-text-secondary); font-size: var(--font-size-small);">
          이 작업은 되돌릴 수 없습니다.
        </p>
      </div>
    `;
    
    const confirmed = await this.modal.confirm(
      '서재에서 삭제',
      deleteMessage,
      '삭제',
      '취소'
    );
    
    if (!confirmed) return;
    
    try {
      await bookService.removeBookFromShelf(userBookId);
      
      // 성공 메시지
      alert('도서가 서재에서 삭제되었습니다.');
      
      // 현재 카테고리의 책들 다시 로드 (화면에서 도서 카드 제거)
      if (this.currentCategory) {
        await this.loadBooksByCategory(this.currentCategory);
      } else {
        await this.loadBookshelf();
      }
      
      // 상태 업데이트
      bookState.removeBook(userBookId);
      
    } catch (error) {
      console.error('삭제 오류:', error);
      alert('삭제 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    }
  }

  /**
   * HTML 특수문자 이스케이프
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
   * 뒤로가기 버튼 설정 (즉시 등록)
   */
  setupBackButton() {
    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.handleBack();
      });
    } else {
      // DOM이 아직 준비되지 않았으면 재시도
      setTimeout(() => this.setupBackButton(), 50);
    }
  }

  /**
   * 뒤로가기 처리
   */
  handleBack() {
    // 홈 화면으로 이동
    window.location.href = '/';
  }

  /**
   * 로딩 상태 설정
   * @param {boolean} loading - 로딩 여부
   */
  setLoading(loading) {
    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = loading ? 'flex' : 'none';
    }
    if (this.bookshelfList) {
      this.bookshelfList.style.display = loading ? 'none' : 'grid';
    }
  }

  /**
   * 빈 상태 표시
   * @param {string} [category] - 현재 선택된 카테고리 (선택사항)
   */
  showEmptyState(category = null) {
    if (this.emptyState) {
      this.emptyState.style.display = 'block';
      
      // 카테고리별 빈 상태 메시지 업데이트
      const emptyStateText = this.emptyState.querySelector('p');
      const emptyStateHint = this.emptyState.querySelector('.empty-state-hint');
      
      if (emptyStateText && category) {
        const categoryLabel = this.getCategoryLabel(category);
        emptyStateText.textContent = `"${categoryLabel}" 카테고리에 책이 없습니다.`;
      } else if (emptyStateText) {
        emptyStateText.textContent = '서재가 비어있습니다.';
      }
    }
    if (this.bookshelfList) {
      this.bookshelfList.style.display = 'none';
    }
  }

  /**
   * 빈 상태 숨김
   */
  hideEmptyState() {
    if (this.emptyState) {
      this.emptyState.style.display = 'none';
    }
    if (this.bookshelfList) {
      this.bookshelfList.style.display = 'grid';
    }
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
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new BookshelfView();
});

export default BookshelfView;

