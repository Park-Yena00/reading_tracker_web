/**
 * 도서 카드 컴포넌트
 * 도서 정보를 카드 형태로 표시하는 재사용 가능한 컴포넌트
 */

import { ROUTES } from '../constants/routes.js';
import authHelper from '../utils/auth-helper.js';
import { optimizeImageUrl } from '../utils/image-url-helper.js';
import { getSafeImageUrl } from '../utils/image-safety.js';

// 기본 표지 이미지 (SVG 데이터 URI - 네트워크 의존성 없음)
const DEFAULT_COVER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob0NvdmVyPC90ZXh0Pjwvc3ZnPg==';

export class BookCard {
  /**
   * 도서 카드 HTML 생성
   * @param {Object} book - 도서 정보 객체
   * @param {string} book.isbn - ISBN
   * @param {string} book.title - 도서명
   * @param {string} book.author - 저자명
   * @param {string} book.publisher - 출판사명
   * @param {string} book.pubDate - 출판일
   * @param {string} book.description - 책 설명
   * @param {string} book.coverUrl - 표지 이미지 URL (백엔드 표준 필드명)
   * @param {boolean} [showAddButton] - 서재 추가 버튼 표시 여부
   * @returns {string} HTML 문자열
   */
  static render(book, showAddButton = false) {
    const isAuthenticated = showAddButton && authHelper.isAuthenticated();
    
    // 표지 이미지 URL 추출
    // 백엔드 표준 필드명: coverUrl (우선 사용)
    // 호환성을 위해 coverImageUrl도 확인 (보조)
    let coverImageUrl = book.coverUrl || book.coverImageUrl || '';
    
    // URL 정리 및 최적화 (고해상도 변환 포함)
    if (coverImageUrl && typeof coverImageUrl === 'string' && coverImageUrl.trim() !== '') {
      coverImageUrl = optimizeImageUrl(coverImageUrl);
      if (!coverImageUrl || coverImageUrl === '') {
        coverImageUrl = DEFAULT_COVER_IMAGE;
      } else {
        coverImageUrl = getSafeImageUrl(coverImageUrl);
      }
    } else {
      coverImageUrl = DEFAULT_COVER_IMAGE;
    }
    
    // 출판일 포맷팅
    const pubDate = book.pubDate ? new Date(book.pubDate).getFullYear() : '';
    
    // 설명 텍스트 잘라내기 (최대 150자)
    const description = book.description 
      ? (book.description.length > 150 
          ? book.description.substring(0, 150) + '...' 
          : book.description)
      : '설명이 없습니다.';
    
    const detailUrl = typeof ROUTES.BOOK_DETAIL === 'function' 
      ? ROUTES.BOOK_DETAIL(book.isbn)
      : `${ROUTES.BOOK_DETAIL}?isbn=${encodeURIComponent(book.isbn)}`;
    
    return `
      <div class="book-card card" data-isbn="${book.isbn}">
        <a href="${detailUrl}" class="book-card-link">
          <div class="book-card-cover">
            <img 
              src="${coverImageUrl}" 
              alt="${this.escapeHtml(book.title || '도서 표지')}"
              class="book-card-image"
              loading="lazy"
              onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2YzZjRmNiIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5Y2EzYWYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5Ob0NvdmVyPC90ZXh0Pjwvc3ZnPg=='; this.style.display='block';"
            />
          </div>
          <div class="book-card-content">
            <h3 class="book-card-title">${this.escapeHtml(book.title || '제목 없음')}</h3>
            <p class="book-card-author">${this.escapeHtml(book.author || '저자 미상')}</p>
            <p class="book-card-publisher">
              ${this.escapeHtml(book.publisher || '출판사 미상')}
              ${pubDate ? ` · ${pubDate}` : ''}
            </p>
            <p class="book-card-description">${this.escapeHtml(description)}</p>
          </div>
        </a>
        ${isAuthenticated ? `
          <div class="book-card-actions">
            <button 
              class="btn btn-primary btn-sm btn-add-to-shelf" 
              data-isbn="${book.isbn}"
              data-title="${this.escapeHtml(book.title || '')}"
            >
              서재에 추가
            </button>
          </div>
        ` : ''}
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

export default BookCard;

