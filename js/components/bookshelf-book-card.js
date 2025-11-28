/**
 * 서재용 도서 카드 컴포넌트
 * 서재 페이지에서 사용하는 도서 카드 (독서 상태, 액션 메뉴 포함)
 */

import { ROUTES } from '../constants/routes.js';
import { formatRelativeTime } from '../utils/date-formatter.js';
import { optimizeImageUrl } from '../utils/image-url-helper.js';
import { getSafeImageUrl } from '../utils/image-safety.js';

// 기본 표지 이미지 (SVG 데이터 URI - 네트워크 의존성 없음)
const DEFAULT_COVER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob0NvdmVyPC90ZXh0Pjwvc3ZnPg==';

export class BookshelfBookCard {
  /**
   * 카테고리 라벨 매핑
   */
  static CATEGORY_LABELS = {
    ToRead: '읽고 싶은 책',
    Reading: '읽는 중',
    AlmostFinished: '거의 다 읽음',
    Finished: '읽은 책',
  };

  /**
   * 카테고리 배지 클래스 매핑
   */
  static CATEGORY_BADGE_CLASSES = {
    ToRead: 'badge badge-want-to-read',
    Reading: 'badge badge-reading',
    AlmostFinished: 'badge badge-reading',
    Finished: 'badge badge-read',
  };

  /**
   * 서재용 도서 카드 HTML 생성
   * @param {Object} book - 서재 도서 정보 객체
   * @param {number} book.userBookId - 사용자 도서 ID
   * @param {string} book.isbn - ISBN
   * @param {string} book.title - 도서명
   * @param {string} book.author - 저자명
   * @param {string} book.publisher - 출판사명
   * @param {string} book.coverUrl - 표지 이미지 URL (백엔드 표준 필드명)
   * @param {string} book.category - 독서 상태 (ToRead, Reading, AlmostFinished, Finished)
   * @param {string} book.addedAt - 추가일
   * @returns {string} HTML 문자열
   */
  static render(book) {
    // 백엔드 표준 필드명: coverUrl (우선 사용)
    // 호환성을 위해 coverImageUrl도 확인 (보조)
    let coverImageUrl = book.coverUrl || book.coverImageUrl || '';
    
    // URL 최적화 (고해상도 변환 포함)
    if (coverImageUrl && coverImageUrl.trim() !== '') {
      coverImageUrl = optimizeImageUrl(coverImageUrl);
      if (!coverImageUrl || coverImageUrl === '') {
        coverImageUrl = DEFAULT_COVER_IMAGE;
      } else {
        coverImageUrl = getSafeImageUrl(coverImageUrl);
      }
    } else {
      coverImageUrl = DEFAULT_COVER_IMAGE;
    }
    const categoryLabel = this.CATEGORY_LABELS[book.category] || book.category;
    const badgeClass = this.CATEGORY_BADGE_CLASSES[book.category] || 'badge';
    
    // 추가일 포맷팅
    let addedDateText = '';
    if (book.addedAt) {
      try {
        addedDateText = formatRelativeTime(book.addedAt);
      } catch (e) {
        addedDateText = book.addedAt;
      }
    }
    
    // 내 서재에서 선택한 도서는 userBookId를 사용하여 별도 세부 정보 화면으로 이동
    const detailUrl = ROUTES.USER_BOOK_DETAIL(book.userBookId);
    
    return `
      <div class="bookshelf-book-card book-card card" data-user-book-id="${book.userBookId}">
        <!-- 메뉴 버튼 -->
        <div class="bookshelf-book-card-menu">
          <button class="btn-menu" data-user-book-id="${book.userBookId}" aria-label="메뉴">
            ⋮
          </button>
          <div class="book-menu-dropdown" id="menu-${book.userBookId}">
            <button class="book-menu-item" data-action="change-status" data-user-book-id="${book.userBookId}">
              상태 변경
            </button>
            <button class="book-menu-item danger" data-action="delete" data-user-book-id="${book.userBookId}">
              서재에서 삭제
            </button>
          </div>
        </div>
        
        <!-- 도서 정보 -->
        <a href="${detailUrl}" class="book-card-link">
          <div class="book-card-cover">
            <img 
              src="${coverImageUrl}" 
              alt="${this.escapeHtml(book.title || '도서 표지')}"
              class="book-card-image"
              loading="lazy"
              onerror="this.onerror=null; console.warn('[BookshelfBookCard] 이미지 로드 실패:', this.src); this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob0NvdmVyPC90ZXh0Pjwvc3ZnPg=='; this.style.display='block';"
            />
          </div>
          <div class="book-card-content">
            <div class="bookshelf-book-status">
              <span class="${badgeClass}">${categoryLabel}</span>
            </div>
            <h3 class="book-card-title">${this.escapeHtml(book.title || '제목 없음')}</h3>
            <p class="book-card-author">${this.escapeHtml(book.author || '저자 미상')}</p>
            <p class="book-card-publisher">${this.escapeHtml(book.publisher || '출판사 미상')}</p>
            ${addedDateText ? `
              <p class="bookshelf-book-added-date">${addedDateText} 추가</p>
            ` : ''}
          </div>
        </a>
      </div>
    `;
  }

  /**
   * HTML 특수문자 이스케이프
   * @param {string} text - 이스케이프할 텍스트
   * @returns {string} 이스케이프된 텍스트
   */
  static escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default BookshelfBookCard;

