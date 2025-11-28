/**
 * 도서 검색 페이지 뷰
 * 도서 검색 폼 처리 및 검색 결과 표시 로직
 */

import bookService from '../../services/book-service.js';
import { BookCard } from '../../components/book-card.js';
import HeaderView from '../common/header.js';
import FooterView from '../common/footer.js';
import { enforceImageSafety } from '../../utils/image-safety.js';

class BookSearchView {
  constructor() {
    this.form = null;
    this.resultsSection = null;
    this.resultsList = null;
    this.loadingSpinner = null;
    this.emptyState = null;
    this.pagination = null;
    
    // 검색 상태
    this.currentQuery = '';
    this.currentQueryType = 'TITLE';
    this.currentPage = 1;
    this.maxResults = 20;
    this.totalResults = 0;
    
    // 이벤트 구독 관리
    this.unsubscribers = [];
    
    // 이벤트 리스너 참조 (정리용)
    this.eventListeners = [];
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    // 이미지 안전성 검사 활성화 (외부 placeholder URL 차단)
    enforceImageSafety();
    
    // 헤더와 푸터 렌더링
    new HeaderView('header');
    new FooterView('footer');
    
    // DOM 요소 선택
    this.form = document.getElementById('search-form');
    this.resultsSection = document.getElementById('results-section');
    this.resultsList = document.getElementById('results-list');
    this.loadingSpinner = document.getElementById('loading-spinner');
    this.emptyState = document.getElementById('empty-state');
    this.pagination = document.getElementById('pagination');
    
    if (!this.form) {
      console.error('Search form not found');
      return;
    }
    
    // 폼 제출 이벤트 리스너
    const handleFormSubmit = (e) => {
      e.preventDefault();
      this.handleSearch();
    };
    this.form.addEventListener('submit', handleFormSubmit);
    this.eventListeners.push({ element: this.form, event: 'submit', handler: handleFormSubmit });
    
    // Enter 키로 검색 가능
    const searchQueryInput = document.getElementById('search-query');
    if (searchQueryInput) {
      const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.handleSearch();
        }
      };
      searchQueryInput.addEventListener('keypress', handleKeyPress);
      this.eventListeners.push({ element: searchQueryInput, event: 'keypress', handler: handleKeyPress });
    }
    
    // URL 파라미터에서 검색어 읽기 (페이지 새로고침 시)
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query');
    const queryType = urlParams.get('queryType') || 'TITLE';
    
    if (query) {
      document.getElementById('search-query').value = query;
      document.getElementById('query-type').value = queryType;
      this.currentQuery = query;
      this.currentQueryType = queryType;
      this.handleSearch();
    }
    
    // 페이지네이션 이벤트 위임 (한 번만 등록)
    if (this.pagination) {
      this.paginationClickHandler = (e) => {
        const btn = e.target.closest('.pagination-btn');
        if (btn && !btn.disabled) {
          const page = parseInt(btn.dataset.page);
          if (!isNaN(page)) {
            this.goToPage(page);
          }
        }
      };
      this.pagination.addEventListener('click', this.paginationClickHandler);
      this.eventListeners.push({ element: this.pagination, event: 'click', handler: this.paginationClickHandler });
    }
  }

  /**
   * 검색 처리
   */
  async handleSearch() {
    const queryInput = document.getElementById('search-query');
    const queryTypeSelect = document.getElementById('query-type');
    
    const query = queryInput?.value.trim();
    const queryType = queryTypeSelect?.value || 'TITLE';
    
    if (!query) {
      alert('검색어를 입력해주세요.');
      return;
    }
    
    // 검색 상태 업데이트
    this.currentQuery = query;
    this.currentQueryType = queryType;
    this.currentPage = 1;
    
    // URL 업데이트 (히스토리 관리)
    const newUrl = new URL(window.location);
    newUrl.searchParams.set('query', query);
    newUrl.searchParams.set('queryType', queryType);
    window.history.pushState({}, '', newUrl);
    
    // 검색 실행
    await this.performSearch();
  }

  /**
   * 실제 검색 API 호출
   */
  async performSearch() {
    this.setLoading(true);
    this.hideResults();
    
    try {
      const response = await bookService.searchBooks({
        query: this.currentQuery,
        queryType: this.currentQueryType,
        start: this.currentPage,
        maxResults: this.maxResults,
      });
      
      this.totalResults = response.totalResults || 0;
      
      if (response.books && response.books.length > 0) {
        this.displayResults(response.books);
        this.displayPagination(response.start, response.maxResults);
        this.showResults();
      } else {
        this.showEmptyState();
      }
    } catch (error) {
      console.error('검색 오류:', error);
      alert('검색 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
      this.showEmptyState();
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 검색 결과 표시
   * @param {Array} books - 도서 배열
   */
  displayResults(books) {
    if (!this.resultsList) return;
    
    this.resultsList.innerHTML = '';
    
    // 도서 검색 결과에서는 서재 추가 버튼을 표시하지 않음
    books.forEach((book) => {
      const cardHtml = BookCard.render(book, false);
      const cardElement = document.createRange().createContextualFragment(cardHtml);
      this.resultsList.appendChild(cardElement);
    });
    
    // 결과 개수 업데이트
    const resultsCountEl = document.getElementById('results-count');
    if (resultsCountEl) {
      resultsCountEl.textContent = this.totalResults.toLocaleString();
    }
  }

  /**
   * 페이지네이션 표시
   * @param {number} start - 시작 위치
   * @param {number} maxResults - 페이지당 결과 수
   */
  displayPagination(start, maxResults) {
    if (!this.pagination || this.totalResults <= maxResults) {
      if (this.pagination) {
        this.pagination.style.display = 'none';
      }
      return;
    }
    
    this.pagination.style.display = 'flex';
    
    const totalPages = Math.ceil(this.totalResults / maxResults);
    const currentPage = Math.floor(start / maxResults) + 1;
    
    let paginationHtml = '';
    
    // 이전 페이지 버튼
    paginationHtml += `
      <button 
        class="pagination-btn" 
        ${currentPage === 1 ? 'disabled' : ''}
        data-page="${currentPage - 1}"
      >
        이전
      </button>
    `;
    
    // 페이지 번호 버튼 (최대 5개 표시)
    const maxPageButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxPageButtons / 2));
    let endPage = Math.min(totalPages, startPage + maxPageButtons - 1);
    
    if (endPage - startPage < maxPageButtons - 1) {
      startPage = Math.max(1, endPage - maxPageButtons + 1);
    }
    
    for (let i = startPage; i <= endPage; i++) {
      paginationHtml += `
        <button 
          class="pagination-btn ${i === currentPage ? 'active' : ''}"
          data-page="${i}"
        >
          ${i}
        </button>
      `;
    }
    
    // 다음 페이지 버튼
    paginationHtml += `
      <button 
        class="pagination-btn"
        ${currentPage === totalPages ? 'disabled' : ''}
        data-page="${currentPage + 1}"
      >
        다음
      </button>
    `;
    
    this.pagination.innerHTML = paginationHtml;
    
    // 이벤트 위임은 init()에서 한 번만 등록되므로 여기서는 HTML만 업데이트
  }

  /**
   * 특정 페이지로 이동
   * @param {number} page - 페이지 번호
   */
  async goToPage(page) {
    this.currentPage = page;
    await this.performSearch();
    
    // 페이지 상단으로 스크롤
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
   * 결과 영역 표시
   */
  showResults() {
    if (this.resultsSection) {
      this.resultsSection.style.display = 'block';
    }
    if (this.emptyState) {
      this.emptyState.style.display = 'none';
    }
    if (this.resultsList) {
      this.resultsList.style.display = 'grid';
    }
  }

  /**
   * 결과 영역 숨김
   */
  hideResults() {
    if (this.resultsSection) {
      this.resultsSection.style.display = 'none';
    }
  }

  /**
   * 빈 상태 표시
   */
  showEmptyState() {
    if (this.resultsSection) {
      this.resultsSection.style.display = 'block';
    }
    if (this.resultsList) {
      this.resultsList.style.display = 'none';
    }
    if (this.emptyState) {
      this.emptyState.style.display = 'block';
    }
    if (this.pagination) {
      this.pagination.style.display = 'none';
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
    
    // 모든 이벤트 리스너 제거
    if (this.eventListeners) {
      this.eventListeners.forEach(({ element, event, handler }) => {
        if (element && handler) {
          element.removeEventListener(event, handler);
        }
      });
      this.eventListeners = [];
    }
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new BookSearchView();
});

export default BookSearchView;

