/**
 * 책 선택 컴포넌트
 * 내 서재에서 책을 선택하는 모달 컴포넌트
 */

import bookService from '../services/book-service.js';

export class BookSelector {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.books = [];
    this.selectedBook = null;
    this.onBookSelect = null; // 책 선택 콜백
    
    // 이벤트 리스너 관리
    this.eventListeners = [];
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    if (!this.container) {
      console.error('Book selector container not found');
      return;
    }

    // 모달 닫기 버튼 및 배경 클릭 (이벤트 위임 사용)
    const handleContainerClick = (e) => {
      // 모달 배경 클릭 시 닫기
      if (e.target === this.container) {
        this.hide();
        return;
      }
      
      // 닫기 버튼 클릭
      if (e.target.closest('.modal-close')) {
        this.hide();
        return;
      }
    };
    this.container.addEventListener('click', handleContainerClick);
    this.eventListeners.push({ element: this.container, event: 'click', handler: handleContainerClick });

      // 책 목록 컨테이너 이벤트 위임 (한 번만 등록)
      const bookListContainer = this.container.querySelector('#book-selector-list');
      if (bookListContainer) {
        const handleBookListClick = (e) => {
          const item = e.target.closest('.book-selector-item');
          if (item) {
            const userBookId = parseInt(item.dataset.userBookId);
            console.log('[BookSelector] 책 클릭:', userBookId);
            const book = this.books.find(b => (b.userBookId === userBookId) || (b.id === userBookId));
            if (book) {
              this.handleBookSelect(book);
            } else {
              console.warn('[BookSelector] 선택된 책을 찾을 수 없습니다:', userBookId);
            }
          }
        };
        bookListContainer.addEventListener('click', handleBookListClick);
        this.eventListeners.push({ element: bookListContainer, event: 'click', handler: handleBookListClick });
      } else {
        console.warn('[BookSelector] 책 목록 컨테이너를 찾을 수 없습니다.');
      }
  }

  /**
   * 모달 표시
   * @param {Function} onBookSelect - 책 선택 콜백 함수 (book) => void
   */
  async show(onBookSelect = null) {
    if (!this.container) {
      console.error('[BookSelector] 컨테이너를 찾을 수 없습니다.');
      return;
    }
    
    console.log('[BookSelector] 모달 표시 시작');
    this.onBookSelect = onBookSelect;
    
    // 모달 표시 (display와 show 클래스 모두 추가)
    this.container.style.display = 'flex';
    this.container.classList.add('show');
    
    // 책 목록 로드
    await this.loadBooks();
    console.log('[BookSelector] 모달 표시 완료');
  }

  /**
   * 모달 숨김
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
      this.container.classList.remove('show');
    }
  }

  /**
   * 책 목록 로드
   * 완독(Finished) 카테고리를 제외한 나머지 카테고리의 책들만 조회
   */
  async loadBooks() {
    try {
      // ToRead, Reading, AlmostFinished 카테고리의 책들만 조회
      // API에서 여러 카테고리를 한 번에 조회할 수 없으므로 각각 조회 후 합침
      const categories = ['ToRead', 'Reading', 'AlmostFinished'];
      const allBooks = [];
      
      for (const category of categories) {
        try {
          const response = await bookService.getBookshelf({ category });
          console.log(`[BookSelector] 카테고리 ${category} 응답:`, response);
          
          // API 응답 구조 확인: response는 이미 data 부분이거나 전체 ApiResponse일 수 있음
          let books = null;
          if (response && response.books && Array.isArray(response.books)) {
            // response가 이미 data 부분인 경우
            books = response.books;
          } else if (response && response.data && response.data.books && Array.isArray(response.data.books)) {
            // response가 전체 ApiResponse인 경우
            books = response.data.books;
          }
          
          if (books && books.length > 0) {
            // 완독(Finished) 카테고리 책은 제외
            const filteredBooks = books.filter(book => book.category !== 'Finished');
            console.log(`[BookSelector] 카테고리 ${category} 필터링된 책 수:`, filteredBooks.length);
            allBooks.push(...filteredBooks);
          } else {
            console.log(`[BookSelector] 카테고리 ${category}에 책이 없습니다.`);
          }
        } catch (error) {
          // 403 에러는 책이 없는 것으로 간주 (정상적인 상태)
          if (error.status === 403 || error.statusCode === 403) {
            console.log(`[BookSelector] 카테고리 ${category}에 책이 없습니다. (403)`);
          } else {
            console.error(`[BookSelector] 카테고리 ${category} 책 목록 로드 오류:`, error);
          }
        }
      }
      
      // 완독 책이 포함되어 있을 경우 추가 필터링 (안전장치)
      const filteredBooks = allBooks.filter(book => book.category !== 'Finished');
      
      console.log(`[BookSelector] 전체 필터링된 책 수:`, filteredBooks.length);
      
      // 도서명 순으로 정렬
      filteredBooks.sort((a, b) => {
        const titleA = (a.title || '').localeCompare('', 'ko');
        const titleB = (b.title || '').localeCompare('', 'ko');
        return titleA.localeCompare(titleB, 'ko');
      });
      
      this.books = filteredBooks;
      console.log(`[BookSelector] 최종 책 목록:`, this.books);
      this.render();
    } catch (error) {
      console.error('[BookSelector] 책 목록 로드 오류:', error);
      alert('책 목록을 불러오는 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
      this.books = [];
      this.render();
    }
  }

  /**
   * 책 목록 렌더링
   */
  render() {
    const bookListContainer = this.container.querySelector('#book-selector-list');
    if (!bookListContainer) {
      console.error('[BookSelector] 책 목록 컨테이너를 찾을 수 없습니다.');
      return;
    }

    console.log(`[BookSelector] 렌더링 시작. 책 수: ${this.books.length}`);

    if (this.books.length === 0) {
      bookListContainer.innerHTML = `
        <div class="empty-state">
          <p>선택 가능한 책이 없습니다.</p>
          <p class="empty-state-hint">서재에 책을 추가해주세요.</p>
        </div>
      `;
      console.log('[BookSelector] 빈 상태 메시지 표시');
      return;
    }

    // 간단한 리스트 형태로 렌더링 (책 이름과 저자명만)
    let html = '<div class="book-selector-list-items">';
    
    this.books.forEach((book) => {
      const title = this.escapeHtml(book.title || '제목 없음');
      const author = this.escapeHtml(book.author || '저자 정보 없음');
      const userBookId = book.userBookId || book.id; // userBookId 또는 id 필드 확인
      
      if (!userBookId) {
        console.warn('[BookSelector] userBookId가 없는 책:', book);
      }
      
      html += `
        <div class="book-selector-item" data-user-book-id="${userBookId}">
          <div class="book-selector-info">
            <div class="book-selector-title">${title}</div>
            <div class="book-selector-author">${author}</div>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    bookListContainer.innerHTML = html;
    console.log(`[BookSelector] 렌더링 완료. HTML 길이: ${html.length}`);

    // 이벤트 위임은 init()에서 한 번만 등록되므로 여기서는 HTML만 업데이트
  }

  /**
   * 책 선택 처리
   * @param {Object} book - 선택된 책 정보
   */
  handleBookSelect(book) {
    this.selectedBook = book;
    
    // 콜백 호출
    if (this.onBookSelect) {
      this.onBookSelect(book);
    }
    
    // 모달 닫기
    this.hide();
  }

  /**
   * 카테고리 라벨 가져오기
   * @param {string} category - 카테고리 코드
   * @returns {string} 카테고리 라벨
   */
  getCategoryLabel(category) {
    const labels = {
      'ToRead': '읽을 예정',
      'Reading': '읽는 중',
      'AlmostFinished': '거의 다 읽음',
      'Finished': '완독'
    };
    return labels[category] || category;
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
   * 컴포넌트 정리 (이벤트 리스너 제거 및 리소스 정리)
   */
  destroy() {
    // 모든 이벤트 리스너 제거
    if (this.eventListeners) {
      this.eventListeners.forEach(({ element, event, handler }) => {
        if (element && handler) {
          element.removeEventListener(event, handler);
        }
      });
      this.eventListeners = [];
    }
    
    // 상태 초기화
    this.books = [];
    this.selectedBook = null;
    this.onBookSelect = null;
  }
}

export default BookSelector;

