
/**
 * 도서 상세 페이지 뷰
 * URL 파라미터에서 ISBN 추출 및 도서 상세 정보 로드 및 표시
 */

import { bookService } from '../../services/book-service.js';
import { authHelper } from '../../utils/auth-helper.js';
import { formatDateKorean } from '../../utils/date-formatter.js';
import { optimizeImageUrl } from '../../utils/image-url-helper.js';
import { getSafeImageUrl } from '../../utils/image-safety.js';
import { ROUTES } from '../../constants/routes.js';
import { BOOK_EVENTS } from '../../constants/events.js';
import { eventBus } from '../../utils/event-bus.js';
import { bookState } from '../../state/book-state.js';
import { HeaderView } from '../common/header.js';
import { FooterView } from '../common/footer.js';

class BookDetailView {
  constructor() {
    this.isbn = null;
    this.userBookId = null; // 서재에 저장된 도서 ID (내 서재에서 선택한 경우)
    this.bookDetail = null;
    this.userBookDetail = null; // 서재에 저장된 도서 상세 정보
    this.loadingSpinner = null;
    this.bookDetailSection = null;
    this.errorSection = null;
    this.modal = null;
    this.currentCategory = null;
    this.unsubscribers = []; // 이벤트 구독 해제 함수들을 저장
    
    // 이벤트 리스너 참조 (정리용)
    this.eventListeners = [];
    
    // 읽은 페이지 수 편집 관련 핸들러 참조
    this.progressEditHandler = null;
    this.progressInputChangeHandler = null;
    this.originalProgressValue = null;
    
    // 이벤트 핸들러 바인딩 (destroy에서 제거하기 위해)
    this.handleBack = this.handleBack.bind(this);
    this.handleErrorBack = this.handleErrorBack.bind(this);
    
    // AlmostFinished 진행률 검증 핸들러
    this.almostFinishedProgressHandler = null;
    
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
    this.bookDetailSection = document.getElementById('book-detail-section');
    this.errorSection = document.getElementById('error-section');
    
    // 이벤트 리스너 등록 (모든 경로에서 공통으로 사용)
    this.setupEventListeners();
    
    // URL 파라미터에서 ISBN 또는 userBookId 추출
    const urlParams = new URLSearchParams(window.location.search);
    this.userBookId = urlParams.get('userBookId');
    this.isbn = urlParams.get('isbn');
    
    // userBookId가 있으면 서재에 저장된 도서 상세 정보 로드
    if (this.userBookId) {
      this.loadUserBookDetail();
      return;
    }
    
    // ISBN이 없으면 에러 표시
    if (!this.isbn) {
      this.showError('도서 ISBN이 제공되지 않았습니다.');
      return;
    }
    
    // 도서 상세 정보 로드 (도서 검색 결과에서 선택한 경우)
    this.loadBookDetail();
    
    // 서재 추가 버튼 이벤트 리스너
    const btnAddToShelf = document.getElementById('btn-add-to-shelf');
    if (btnAddToShelf) {
      const handleAddToShelfClick = () => {
        this.handleAddToShelf();
      };
      btnAddToShelf.addEventListener('click', handleAddToShelfClick);
      this.eventListeners.push({ element: btnAddToShelf, event: 'click', handler: handleAddToShelfClick });
    }
    
    // 독서 시작하기 버튼 이벤트 위임 (버튼이 동적으로 표시되므로 이벤트 위임 사용)
    const bookDetailHeader = document.querySelector('.book-detail-header');
    if (bookDetailHeader) {
      const handleHeaderClick = (e) => {
        if (e.target && e.target.id === 'btn-start-reading') {
          this.handleStartReading();
        }
      };
      bookDetailHeader.addEventListener('click', handleHeaderClick);
      this.eventListeners.push({ element: bookDetailHeader, event: 'click', handler: handleHeaderClick });
    }
    
    // 모달 관련 이벤트 리스너 설정
    this.setupModalListeners();
  }
  
  /**
   * 이벤트 리스너 설정 (뒤로가기 버튼 등)
   */
  setupEventListeners() {
    // 뒤로가기 버튼 이벤트 리스너
    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
      btnBack.addEventListener('click', this.handleBack);
      this.eventListeners.push({ element: btnBack, event: 'click', handler: this.handleBack });
    }
    
    // 에러 섹션 뒤로가기 버튼 이벤트 리스너
    const btnErrorBack = document.getElementById('btn-error-back');
    if (btnErrorBack) {
      btnErrorBack.addEventListener('click', this.handleErrorBack);
      this.eventListeners.push({ element: btnErrorBack, event: 'click', handler: this.handleErrorBack });
    }
    
    // 서재 추가 버튼 이벤트 리스너
    const btnAddToShelf = document.getElementById('btn-add-to-shelf');
    if (btnAddToShelf) {
      const handleAddToShelfClick = () => {
        this.handleAddToShelf();
      };
      btnAddToShelf.addEventListener('click', handleAddToShelfClick);
      this.eventListeners.push({ element: btnAddToShelf, event: 'click', handler: handleAddToShelfClick });
    }
    
    // 독서 시작하기 버튼 이벤트 위임 (버튼이 동적으로 표시되므로 이벤트 위임 사용)
    const bookDetailHeader = document.querySelector('.book-detail-header');
    if (bookDetailHeader) {
      const handleHeaderClick = (e) => {
        if (e.target && e.target.id === 'btn-start-reading') {
          this.handleStartReading();
        }
      };
      bookDetailHeader.addEventListener('click', handleHeaderClick);
      this.eventListeners.push({ element: bookDetailHeader, event: 'click', handler: handleHeaderClick });
    }
  }
  
  /**
   * 모달 이벤트 리스너 설정
   */
  setupModalListeners() {
    this.modal = document.getElementById('add-to-shelf-modal');
    this.startReadingModal = document.getElementById('start-reading-modal');
    this.finishReadingModal = document.getElementById('finish-reading-modal');
    const categorySelect = document.getElementById('category-select');
    const modalCloseBtn = document.getElementById('modal-close-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    const modalSubmitBtn = document.getElementById('modal-submit-btn');
    
    // 독서 시작하기 모달 관련 버튼
    const startReadingModalCloseBtn = document.getElementById('start-reading-modal-close-btn');
    const startReadingModalSubmitBtn = document.getElementById('start-reading-modal-submit-btn');
    
    // 완독 처리 모달 관련 버튼
    const finishReadingModalCloseBtn = document.getElementById('finish-reading-modal-close-btn');
    const finishReadingModalSubmitBtn = document.getElementById('finish-reading-modal-submit-btn');
    
    // 카테고리 변경 이벤트
    if (categorySelect) {
      const handleCategoryChange = (e) => {
        this.handleCategoryChange(e.target.value);
      };
      categorySelect.addEventListener('change', handleCategoryChange);
      this.eventListeners.push({ element: categorySelect, event: 'change', handler: handleCategoryChange });
    }
    
    // 모달 닫기 버튼
    if (modalCloseBtn) {
      const handleClose = () => {
        this.hideAddToShelfModal();
      };
      modalCloseBtn.addEventListener('click', handleClose);
      this.eventListeners.push({ element: modalCloseBtn, event: 'click', handler: handleClose });
    }
    
    // 취소 버튼
    if (modalCancelBtn) {
      const handleCancel = () => {
        this.hideAddToShelfModal();
      };
      modalCancelBtn.addEventListener('click', handleCancel);
      this.eventListeners.push({ element: modalCancelBtn, event: 'click', handler: handleCancel });
    }
    
    // 제출 버튼
    if (modalSubmitBtn) {
      const handleSubmit = () => {
        this.submitAddToShelfForm();
      };
      modalSubmitBtn.addEventListener('click', handleSubmit);
      this.eventListeners.push({ element: modalSubmitBtn, event: 'click', handler: handleSubmit });
    }
    
    // 모달 외부 클릭 시 닫기
    if (this.modal) {
      const handleModalClick = (e) => {
        if (e.target === this.modal) {
          this.hideAddToShelfModal();
        }
      };
      this.modal.addEventListener('click', handleModalClick);
      this.eventListeners.push({ element: this.modal, event: 'click', handler: handleModalClick });
    }
    
    // 독서 시작하기 모달 닫기 버튼
    if (startReadingModalCloseBtn) {
      const handleClose = () => {
        this.hideStartReadingModal();
      };
      startReadingModalCloseBtn.addEventListener('click', handleClose);
      this.eventListeners.push({ element: startReadingModalCloseBtn, event: 'click', handler: handleClose });
    }
    
    // 독서 시작하기 모달 제출 버튼
    if (startReadingModalSubmitBtn) {
      const handleSubmit = () => {
        this.submitStartReadingForm();
      };
      startReadingModalSubmitBtn.addEventListener('click', handleSubmit);
      this.eventListeners.push({ element: startReadingModalSubmitBtn, event: 'click', handler: handleSubmit });
    }
    
    // 독서 시작하기 모달 외부 클릭 시 닫기
    if (this.startReadingModal) {
      const handleModalClick = (e) => {
        if (e.target === this.startReadingModal) {
          this.hideStartReadingModal();
        }
      };
      this.startReadingModal.addEventListener('click', handleModalClick);
      this.eventListeners.push({ element: this.startReadingModal, event: 'click', handler: handleModalClick });
    }
    
    
  }

  /**
   * 서재에 저장된 도서 상세 정보 로드 (오프라인 지원 개선)
   */
  async loadUserBookDetail() {
    this.setLoading(true);
    this.hideError();
    this.hideBookDetail();
    
    try {
      // 서재에 저장된 도서 정보 가져오기 (하이브리드 전략 적용)
      const rawUserBookDetail = await bookService.getUserBookDetail(this.userBookId);
      
      // 백엔드 필드명을 프론트엔드 필드명으로 매핑
      // MyShelfResponse.ShelfBook은 lastReadPage, lastReadAt을 사용하지만
      // 프론트엔드는 readingProgress, readingStartDate를 기대함
      this.userBookDetail = {
        ...rawUserBookDetail,
        // 필드명 매핑 (백엔드가 lastReadPage/lastReadAt을 반환하는 경우)
        readingProgress: rawUserBookDetail.readingProgress !== undefined && rawUserBookDetail.readingProgress !== null 
          ? rawUserBookDetail.readingProgress 
          : (rawUserBookDetail.lastReadPage !== undefined && rawUserBookDetail.lastReadPage !== null 
              ? rawUserBookDetail.lastReadPage 
              : null),
        readingStartDate: rawUserBookDetail.readingStartDate || rawUserBookDetail.lastReadAt || null,
        // 다른 필드도 확인
        totalPages: rawUserBookDetail.totalPages || null,
      };
      
      // ISBN 추출
      this.isbn = this.userBookDetail.isbn;
      
      // 도서 기본 정보 조회 (하이브리드 전략 적용, 오프라인 지원)
      try {
        this.bookDetail = await bookService.getBookDetail(this.isbn);
      } catch (error) {
        // 도서 기본 정보 조회 실패 시 내 서재 정보에서 추출 (추가 폴백)
        console.warn('도서 기본 정보 조회 실패, 내 서재 정보에서 추출:', error);
        if (this.userBookDetail) {
          this.bookDetail = {
            isbn: this.userBookDetail.isbn,
            title: this.userBookDetail.title,
            author: this.userBookDetail.author,
            publisher: this.userBookDetail.publisher,
            pubDate: this.userBookDetail.pubDate,
            description: this.userBookDetail.description,
            coverUrl: this.userBookDetail.coverUrl,
            totalPages: this.userBookDetail.totalPages,
            mainGenre: this.userBookDetail.mainGenre,
            price: null,
            category: null
          };
        } else {
          throw error; // 원래 에러를 다시 던짐
        }
      }
      
      // totalPages가 bookDetail에 있으면 사용
      if (this.bookDetail?.totalPages && !this.userBookDetail.totalPages) {
        this.userBookDetail.totalPages = this.bookDetail.totalPages;
      }
      
      // 도서 기본 정보 + 서재 저장 정보 표시
      this.displayUserBookDetail(this.bookDetail, this.userBookDetail);
      this.updateAuthUI();
    } catch (error) {
      console.error('서재 도서 상세 정보 로드 오류:', error);
      this.showError(error.message || '도서 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 도서 상세 정보 로드
   */
  async loadBookDetail() {
    this.setLoading(true);
    this.hideError();
    this.hideBookDetail();
    
    try {
      const bookDetail = await bookService.getBookDetail(this.isbn);
      this.bookDetail = bookDetail;
      this.displayBookDetail(bookDetail);
      this.updateAuthUI();
    } catch (error) {
      console.error('도서 상세 정보 로드 오류:', error);
      this.showError(error.message || '도서 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 도서 상세 정보 표시
   * @param {Object} book - 도서 상세 정보 객체
   */
  displayBookDetail(book) {
    // 표지 이미지 (백엔드 표준 필드명: coverUrl 우선 사용)
    const coverImage = document.getElementById('book-cover-image');
    if (coverImage) {
      // 백엔드 표준 필드명: coverUrl (우선 사용)
      // 호환성을 위해 coverImageUrl도 확인 (보조)
      let coverImageUrl = book.coverUrl || book.coverImageUrl || '';
      
      // URL 정리 및 최적화 (고해상도 변환 포함)
      if (coverImageUrl && coverImageUrl.trim() !== '') {
        coverImageUrl = optimizeImageUrl(coverImageUrl);
        if (coverImageUrl && coverImageUrl !== '') {
          coverImageUrl = getSafeImageUrl(coverImageUrl);
        }
      } else {
        coverImageUrl = '';
      }
      
      // 유효한 URL 설정
      if (coverImageUrl) {
        coverImage.src = coverImageUrl;
        coverImage.style.display = 'block';
        // placeholder 숨기기
        const placeholder = coverImage.nextElementSibling;
        if (placeholder && placeholder.classList.contains('book-cover-placeholder')) {
          placeholder.style.display = 'none';
        }
        
        // 이미지 로딩 실패 시 placeholder 표시 (오프라인 지원)
        coverImage.onerror = () => {
          console.warn('도서 표지 이미지 로딩 실패:', coverImageUrl);
          coverImage.style.display = 'none';
          const placeholder = coverImage.nextElementSibling;
          if (placeholder && placeholder.classList.contains('book-cover-placeholder')) {
            placeholder.style.display = 'flex';
          }
        };
      } else {
        // URL이 없으면 이미지 숨기고 placeholder 표시
        coverImage.style.display = 'none';
        const placeholder = coverImage.nextElementSibling;
        if (placeholder && placeholder.classList.contains('book-cover-placeholder')) {
          placeholder.style.display = 'flex';
        }
      }
      coverImage.alt = (book.title && book.title.trim() !== '') ? book.title : '';
    }
    
    // 제목
    const titleEl = document.getElementById('book-title');
    if (titleEl) {
      titleEl.textContent = (book.title && book.title.trim() !== '') ? book.title : '';
    }
    
    // 저자
    const authorEl = document.getElementById('book-author');
    if (authorEl) {
      const author = book.author && book.author.trim() !== '' ? book.author : '';
      authorEl.textContent = author;
    }
    
    // 출판사
    const publisherEl = document.getElementById('book-publisher');
    if (publisherEl) {
      const publisher = book.publisher && book.publisher.trim() !== '' ? book.publisher : '';
      publisherEl.textContent = publisher;
    }
    
    // 출판일
    const pubDateEl = document.getElementById('book-pub-date');
    if (pubDateEl) {
      if (book.pubDate) {
        try {
          // LocalDate 형식 (YYYY-MM-DD) 또는 Date 객체 지원
          const formattedDate = formatDateKorean(book.pubDate) || formatDateKorean(new Date(book.pubDate)) || book.pubDate;
          pubDateEl.textContent = (formattedDate && formattedDate.trim() !== '') ? formattedDate : '';
        } catch (e) {
          // 날짜 파싱 실패 시 원본 값 표시
          const pubDate = book.pubDate && String(book.pubDate).trim() !== '' ? String(book.pubDate) : '';
          pubDateEl.textContent = pubDate;
        }
      } else {
        pubDateEl.textContent = '';
      }
    }
    
    // ISBN
    const isbnEl = document.getElementById('book-isbn');
    if (isbnEl) {
      const isbn = book.isbn && book.isbn.trim() !== '' ? book.isbn : '';
      isbnEl.textContent = isbn;
    }
    
    // 전체 페이지 분량
    const totalPagesItemEl = document.getElementById('book-total-pages-item');
    const totalPagesEl = document.getElementById('book-total-pages');
    if (book.totalPages !== null && book.totalPages !== undefined) {
      if (totalPagesItemEl) {
        totalPagesItemEl.style.display = 'flex';
      }
      if (totalPagesEl) {
        totalPagesEl.textContent = `${book.totalPages}쪽`;
      }
    } else {
      if (totalPagesItemEl) {
        totalPagesItemEl.style.display = 'none';
      }
    }
    
    // 태그 (메인 장르)
    const mainGenreItemEl = document.getElementById('book-main-genre-item');
    const mainGenreEl = document.getElementById('book-main-genre');
    if (book.mainGenre && book.mainGenre.trim() !== '') {
      if (mainGenreItemEl) {
        mainGenreItemEl.style.display = 'flex';
      }
      if (mainGenreEl) {
        mainGenreEl.textContent = book.mainGenre;
      }
    } else {
      if (mainGenreItemEl) {
        mainGenreItemEl.style.display = 'none';
      }
    }
    
    // 가격
    const priceItemEl = document.getElementById('book-price-item');
    const priceEl = document.getElementById('book-price');
    if (book.price !== null && book.price !== undefined) {
      if (priceItemEl) {
        priceItemEl.style.display = 'flex';
      }
      if (priceEl) {
        priceEl.textContent = `${Number(book.price).toLocaleString()}원`;
      }
    } else {
      if (priceItemEl) {
        priceItemEl.style.display = 'none';
      }
    }
    
    // 카테고리
    const categoryItemEl = document.getElementById('book-category-item');
    const categoryEl = document.getElementById('book-category');
    if (book.category) {
      if (categoryItemEl) {
        categoryItemEl.style.display = 'flex';
      }
      if (categoryEl) {
        categoryEl.textContent = book.category;
      }
    } else {
      if (categoryItemEl) {
        categoryItemEl.style.display = 'none';
      }
    }
    
    // 설명
    const descriptionEl = document.getElementById('book-description');
    if (descriptionEl) {
      const description = book.description && book.description.trim() !== '' ? book.description : '';
      descriptionEl.textContent = description;
    }
    
    // 페이지 제목 업데이트
    if (book.title) {
      document.title = `${book.title} - Reading Tracker`;
    } else {
      document.title = 'Reading Tracker';
    }
    
    // 도서 상세 정보 표시
    this.showBookDetail();
  }

  /**
   * 서재에 저장된 도서 상세 정보 표시 (도서 기본 정보 + 서재 저장 정보)
   * @param {Object} bookDetail - 도서 기본 정보
   * @param {Object} userBookDetail - 서재에 저장된 도서 정보
   */
  displayUserBookDetail(bookDetail, userBookDetail) {
    // 먼저 도서 기본 정보 표시
    this.displayBookDetail(bookDetail);
    
    // 서재 정보 섹션 표시
    const userBookInfoSection = document.getElementById('user-book-info-section');
    if (userBookInfoSection) {
      userBookInfoSection.style.display = 'block';
    }
    
    // 카테고리 정보 (여러 곳에서 사용)
    const category = userBookDetail.category;
    
    // 1. 카테고리 - 항상 표시
    const categoryItemEl = document.getElementById('user-book-category-item');
    const categoryEl = document.getElementById('user-book-category');
    if (categoryItemEl) {
      categoryItemEl.style.display = 'flex';
    }
    if (categoryEl) {
      const categoryLabels = {
        'ToRead': '읽을 예정',
        'Reading': '읽는 중',
        'AlmostFinished': '거의 다 읽음',
        'Finished': '완독',
      };
      categoryEl.textContent = categoryLabels[category] || category;
    }
    
    // 2. 기대평 - 항상 표시 (값이 없으면 빈 칸)
    // ToRead 카테고리에서 입력받을 수 있으므로 항상 표시
    const expectationItemEl = document.getElementById('user-book-expectation-item');
    const expectationEl = document.getElementById('user-book-expectation');
    if (expectationItemEl) {
      expectationItemEl.style.display = 'flex';
    }
    if (expectationEl) {
      expectationEl.textContent = userBookDetail.expectation || '';
    }
    
    // 3. 구매/대여 여부 - 모든 카테고리에서 항상 표시 및 변경 가능 (값이 없으면 빈 칸)
    const purchaseTypeItemEl = document.getElementById('user-book-purchase-type-item');
    const purchaseTypeSelect = document.getElementById('user-book-purchase-type-select');
    const btnSavePurchaseType = document.getElementById('btn-save-purchase-type');
    const btnCancelPurchaseType = document.getElementById('btn-cancel-purchase-type');
    if (purchaseTypeItemEl) {
      purchaseTypeItemEl.style.display = 'flex';
    }
    if (purchaseTypeSelect) {
      // 값 설정 (없으면 빈 값)
      const currentPurchaseType = userBookDetail.purchaseType || '';
      purchaseTypeSelect.value = currentPurchaseType;
      // 모든 카테고리에서 수정 가능하도록 항상 활성화
      purchaseTypeSelect.disabled = false;
      // 원본 값 저장 (취소 시 복원용)
      this.originalPurchaseTypeValue = currentPurchaseType;
      
      // select 변경 이벤트 리스너 추가 (저장 버튼 표시)
      if (!this.purchaseTypeChangeHandler) {
        this.purchaseTypeChangeHandler = () => {
          this.handlePurchaseTypeChange();
        };
        purchaseTypeSelect.addEventListener('change', this.purchaseTypeChangeHandler);
        this.eventListeners.push({ element: purchaseTypeSelect, event: 'change', handler: this.purchaseTypeChangeHandler });
      }
    }
    // 저장/취소 버튼 이벤트 리스너 추가
    if (btnSavePurchaseType && !this.purchaseTypeSaveHandler) {
      this.purchaseTypeSaveHandler = () => {
        this.handleSavePurchaseType();
      };
      btnSavePurchaseType.addEventListener('click', this.purchaseTypeSaveHandler);
      this.eventListeners.push({ element: btnSavePurchaseType, event: 'click', handler: this.purchaseTypeSaveHandler });
    }
    if (btnCancelPurchaseType && !this.purchaseTypeCancelHandler) {
      this.purchaseTypeCancelHandler = () => {
        this.handleCancelPurchaseType();
      };
      btnCancelPurchaseType.addEventListener('click', this.purchaseTypeCancelHandler);
      this.eventListeners.push({ element: btnCancelPurchaseType, event: 'click', handler: this.purchaseTypeCancelHandler });
    }
    // 초기 상태: 저장/취소 버튼 숨김
    if (btnSavePurchaseType) {
      btnSavePurchaseType.style.display = 'none';
    }
    if (btnCancelPurchaseType) {
      btnCancelPurchaseType.style.display = 'none';
    }
    
    // 4. 독서 시작일 (Reading, AlmostFinished, Finished 카테고리 - 항상 표시, 값이 없으면 빈 칸)
    // 이 카테고리들에서 입력받은 필수 필드이므로 항상 표시해야 함
    const readingStartDateItemEl = document.getElementById('user-book-reading-start-date-item');
    const readingStartDateEl = document.getElementById('user-book-reading-start-date');
    const shouldShowReadingStartDate = category === 'Reading' || category === 'AlmostFinished' || category === 'Finished';
    if (shouldShowReadingStartDate) {
      if (readingStartDateItemEl) {
        readingStartDateItemEl.style.display = 'flex';
      }
      if (readingStartDateEl) {
        if (userBookDetail.readingStartDate) {
          try {
            readingStartDateEl.textContent = formatDateKorean(userBookDetail.readingStartDate) || userBookDetail.readingStartDate;
          } catch (e) {
            readingStartDateEl.textContent = userBookDetail.readingStartDate;
          }
        } else {
          // 값이 없으면 빈 칸으로 표시
          readingStartDateEl.textContent = '';
        }
      }
    } else {
      if (readingStartDateItemEl) {
        readingStartDateItemEl.style.display = 'none';
      }
    }
    
    // 6. 독서 진행률 (Reading, AlmostFinished, Finished 카테고리 - 항상 표시, 값이 없으면 빈 칸)
    // 이 카테고리들에서 입력받은 필수 필드이므로 항상 표시해야 함
    const readingProgressItemEl = document.getElementById('user-book-reading-progress-item');
    const readingProgressEl = document.getElementById('user-book-reading-progress');
    const readingProgressInput = document.getElementById('user-book-reading-progress-input');
    const btnEditProgress = document.getElementById('btn-edit-progress');
    const btnSaveProgress = document.getElementById('btn-save-progress');
    const btnCancelProgress = document.getElementById('btn-cancel-progress');
    const progressBarContainer = document.getElementById('reading-progress-bar-container');
    const progressBarFill = document.getElementById('reading-progress-bar-fill');
    const progressPercentage = document.getElementById('reading-progress-percentage');
    
    const shouldShowReadingProgress = category === 'Reading' || category === 'AlmostFinished' || category === 'Finished';
    if (shouldShowReadingProgress) {
      if (readingProgressItemEl) {
        readingProgressItemEl.style.display = 'flex';
      }
      
      const totalPages = bookDetail.totalPages || userBookDetail.totalPages;
      const currentPages = userBookDetail.readingProgress;
      
      if (currentPages !== null && currentPages !== undefined) {
        // 페이지 수 표시
        this.updateReadingProgressDisplay(currentPages, totalPages, readingProgressEl);
        
        // 게이지 바 표시 (Reading, AlmostFinished, Finished 카테고리 모두)
        // Finished 카테고리에서는 편집 불가능 (읽기 전용)
        if (totalPages && totalPages > 0) {
          // 게이지 바 표시 및 업데이트 (모든 카테고리에서 표시)
          this.updateProgressBar(currentPages, totalPages, progressBarContainer, progressBarFill, progressPercentage);
          
          // 편집 버튼 표시 (Reading, AlmostFinished 카테고리에서만)
          if (category === 'Reading' || category === 'AlmostFinished') {
            if (btnEditProgress) {
              btnEditProgress.style.display = 'inline-block';
              // 편집 버튼 이벤트 리스너 (이벤트 위임 사용, 한 번만 등록)
              if (!this.progressEditHandler) {
                this.progressEditHandler = (e) => {
                  if (e.target.id === 'btn-edit-progress') {
                    this.handleEditProgress();
                  } else if (e.target.id === 'btn-save-progress') {
                    this.handleSaveProgress();
                  } else if (e.target.id === 'btn-cancel-progress') {
                    this.handleCancelProgress();
                  }
                };
                readingProgressItemEl.addEventListener('click', this.progressEditHandler);
                this.eventListeners.push({ element: readingProgressItemEl, event: 'click', handler: this.progressEditHandler });
              }
            }
            
            // 입력 필드 변경 이벤트 (실시간 진행률 업데이트, 한 번만 등록)
            if (readingProgressInput && !this.progressInputChangeHandler) {
              this.progressInputChangeHandler = () => {
                this.handleProgressInputChange();
              };
              readingProgressInput.addEventListener('input', this.progressInputChangeHandler);
              this.eventListeners.push({ element: readingProgressInput, event: 'input', handler: this.progressInputChangeHandler });
            }
          } else if (category === 'Finished') {
            // Finished 카테고리에서는 편집 버튼 숨기기
            if (btnEditProgress) {
              btnEditProgress.style.display = 'none';
            }
            // Finished 카테고리에서는 편집 관련 이벤트 리스너도 제거
            if (this.progressEditHandler && readingProgressItemEl) {
              readingProgressItemEl.removeEventListener('click', this.progressEditHandler);
              // eventListeners에서도 제거
              this.eventListeners = this.eventListeners.filter(
                listener => !(listener.element === readingProgressItemEl && listener.event === 'click' && listener.handler === this.progressEditHandler)
              );
              this.progressEditHandler = null;
            }
            if (this.progressInputChangeHandler && readingProgressInput) {
              readingProgressInput.removeEventListener('input', this.progressInputChangeHandler);
              // eventListeners에서도 제거
              this.eventListeners = this.eventListeners.filter(
                listener => !(listener.element === readingProgressInput && listener.event === 'input' && listener.handler === this.progressInputChangeHandler)
              );
              this.progressInputChangeHandler = null;
            }
          }
        } else {
          // 전체 페이지 수가 없으면 게이지 바 및 편집 버튼 숨기기
          if (progressBarContainer) {
            progressBarContainer.style.display = 'none';
          }
          if (btnEditProgress) {
            btnEditProgress.style.display = 'none';
          }
        }
      } else {
        // 값이 없으면 빈 칸으로 표시
        if (readingProgressEl) {
          readingProgressEl.textContent = '';
        }
        // 게이지 바 및 편집 버튼 숨기기
        if (progressBarContainer) {
          progressBarContainer.style.display = 'none';
        }
        if (btnEditProgress) {
          btnEditProgress.style.display = 'none';
        }
        // Finished 카테고리에서는 편집 관련 이벤트 리스너도 제거
        if (category === 'Finished') {
          if (this.progressEditHandler && readingProgressItemEl) {
            readingProgressItemEl.removeEventListener('click', this.progressEditHandler);
            // eventListeners에서도 제거
            this.eventListeners = this.eventListeners.filter(
              listener => !(listener.element === readingProgressItemEl && listener.event === 'click' && listener.handler === this.progressEditHandler)
            );
            this.progressEditHandler = null;
          }
          if (this.progressInputChangeHandler && readingProgressInput) {
            readingProgressInput.removeEventListener('input', this.progressInputChangeHandler);
            // eventListeners에서도 제거
            this.eventListeners = this.eventListeners.filter(
              listener => !(listener.element === readingProgressInput && listener.event === 'input' && listener.handler === this.progressInputChangeHandler)
            );
            this.progressInputChangeHandler = null;
          }
        }
      }
    } else {
      if (readingProgressItemEl) {
        readingProgressItemEl.style.display = 'none';
      }
    }
    
    // 5. 독서 종료일 (Finished 카테고리 - 항상 표시, 값이 없으면 빈 칸)
    // Finished 카테고리에서 입력받은 필수 필드이므로 항상 표시해야 함
    const readingFinishedDateItemEl = document.getElementById('user-book-reading-finished-date-item');
    const readingFinishedDateEl = document.getElementById('user-book-reading-finished-date');
    if (category === 'Finished') {
      if (readingFinishedDateItemEl) {
        readingFinishedDateItemEl.style.display = 'flex';
      }
      if (readingFinishedDateEl) {
        if (userBookDetail.readingFinishedDate) {
          try {
            readingFinishedDateEl.textContent = formatDateKorean(userBookDetail.readingFinishedDate) || userBookDetail.readingFinishedDate;
          } catch (e) {
            readingFinishedDateEl.textContent = userBookDetail.readingFinishedDate;
          }
        } else {
          // 값이 없으면 빈 칸으로 표시
          readingFinishedDateEl.textContent = '';
        }
      }
    } else {
      if (readingFinishedDateItemEl) {
        readingFinishedDateItemEl.style.display = 'none';
      }
    }
    
    // 평점 (Finished 카테고리 - 내 서재 정보 섹션 상단 중앙에 별점으로 표시)
    const ratingStarsContainer = document.getElementById('user-book-rating-stars-container');
    const ratingStarsEl = document.getElementById('user-book-rating-stars');
    
    if (category === 'Finished') {
      if (ratingStarsContainer && ratingStarsEl) {
        // rating 값이 있으면 별점 표시
        if (userBookDetail.rating !== null && userBookDetail.rating !== undefined) {
          const ratingValue = parseInt(userBookDetail.rating, 10);
          if (!isNaN(ratingValue) && ratingValue >= 1 && ratingValue <= 5) {
            this.displayRatingStars(ratingStarsEl, ratingValue, false);
            ratingStarsContainer.style.display = 'flex';
          } else {
            ratingStarsContainer.style.display = 'none';
          }
        } else {
          ratingStarsContainer.style.display = 'none';
        }
      }
    } else {
      if (ratingStarsContainer) {
        ratingStarsContainer.style.display = 'none';
      }
    }
    
    // 평점 항목 (기존 항목은 숨김 처리)
    const ratingItemEl = document.getElementById('user-book-rating-item');
    if (ratingItemEl) {
      ratingItemEl.style.display = 'none';
    }
    
    // 도서명 우측 별점 영역 숨김 (더 이상 사용하지 않음)
    const bookTitleRatingStars = document.getElementById('book-rating-stars');
    if (bookTitleRatingStars) {
      bookTitleRatingStars.style.display = 'none';
    }
    
    
    // 서재 추가일 (표시하지 않음)
    const addedAtItemEl = document.getElementById('user-book-added-at-item');
    if (addedAtItemEl) {
      addedAtItemEl.style.display = 'none';
    }
    
    // 7. 후기 (Finished 카테고리 - 항상 표시, 값이 없으면 빈 칸)
    // Finished 카테고리에서 입력받은 선택 필드이므로 항상 표시해야 함
    const reviewItemEl = document.getElementById('user-book-review-item');
    const reviewEl = document.getElementById('user-book-review');
    if (category === 'Finished') {
      if (reviewItemEl) {
        reviewItemEl.style.display = 'flex';
      }
      if (reviewEl) {
        if (userBookDetail.review) {
          reviewEl.textContent = userBookDetail.review;
        } else {
          // 값이 없으면 빈 칸으로 표시
          reviewEl.textContent = '';
        }
      }
    } else {
      if (reviewItemEl) {
        reviewItemEl.style.display = 'none';
      }
    }
    
    // 서재 추가 버튼 숨기기 (이미 서재에 저장된 도서이므로)
    const btnAddToShelf = document.getElementById('btn-add-to-shelf');
    if (btnAddToShelf) {
      btnAddToShelf.style.display = 'none';
    }
    
    // ToRead 카테고리일 때 "독서 시작하기" 버튼 표시
    const startReadingAction = document.getElementById('start-reading-action');
    const btnStartReading = document.getElementById('btn-start-reading');
    if (userBookDetail.category === 'ToRead') {
      if (startReadingAction) {
        startReadingAction.style.display = 'block';
      }
    } else {
      if (startReadingAction) {
        startReadingAction.style.display = 'none';
      }
    }
  }

  /**
   * 인증 상태에 따라 UI 업데이트
   */
  updateAuthUI() {
    const bookActionsEl = document.getElementById('book-actions');
    if (bookActionsEl) {
      if (authHelper.isAuthenticated()) {
        bookActionsEl.style.display = 'block';
      } else {
        bookActionsEl.style.display = 'none';
      }
    }
  }

  /**
   * 서재에 추가 처리 (모달 표시)
   */
  handleAddToShelf() {
    // 인증 확인
    if (!authHelper.isAuthenticated()) {
      const confirmed = confirm('로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?');
      if (confirmed) {
        window.location.href = ROUTES.LOGIN;
      }
      return;
    }
    
    if (!this.bookDetail) {
      alert('도서 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    // 모달 표시
    this.showAddToShelfModal();
  }

  /**
   * 독서 시작하기 처리 (모달 표시)
   */
  handleStartReading() {
    // 인증 확인
    if (!authHelper.isAuthenticated()) {
      const confirmed = confirm('로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?');
      if (confirmed) {
        window.location.href = ROUTES.LOGIN;
      }
      return;
    }
    
    if (!this.userBookId) {
      console.error('userBookId가 없습니다.');
      alert('도서 정보를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    
    // 모달 표시
    this.showStartReadingModal();
  }
  
  /**
   * 모달 표시 및 초기화
   */
  showAddToShelfModal() {
    if (!this.modal) return;
    
    // 모달 표시
    this.modal.style.display = 'flex';
    setTimeout(() => {
      this.modal.classList.add('show');
    }, 10);
    
    // 폼 초기화
    const form = document.getElementById('add-to-shelf-form');
    if (form) {
      form.reset();
    }
    
    // 카테고리 기본값 설정
    const categorySelect = document.getElementById('category-select');
    if (categorySelect) {
      categorySelect.value = 'ToRead';
      this.handleCategoryChange('ToRead');
    }
    
    // 전체 페이지 수 힌트 업데이트
    this.updateProgressHints();
    
    // AlmostFinished 관련 메시지 숨김
    this.hideAlmostFinishedInfoMessage();
    this.hideAlmostFinishedValidationMessage();
  }
  
  /**
   * 모달 숨기기
   */
  hideAddToShelfModal() {
    if (!this.modal) return;
    
    // AlmostFinished 관련 메시지 숨김
    this.hideAlmostFinishedInfoMessage();
    this.hideAlmostFinishedValidationMessage();
    
    this.modal.classList.remove('show');
    setTimeout(() => {
      this.modal.style.display = 'none';
    }, 200);
    
    // 폼 초기화
    const form = document.getElementById('add-to-shelf-form');
    if (form) {
      form.reset();
    }
    
    // 모든 카테고리 필드 숨기기
    document.querySelectorAll('.category-fields').forEach(field => {
      field.style.display = 'none';
    });
    
    this.currentCategory = null;
  }
  
  /**
   * 카테고리 변경 처리
   * @param {string} category - 선택된 카테고리
   */
  handleCategoryChange(category) {
    this.currentCategory = category;
    
    // 모든 카테고리 필드 숨기기
    document.querySelectorAll('.category-fields').forEach(field => {
      field.style.display = 'none';
    });
    
    // 선택된 카테고리에 해당하는 필드만 표시
    let fieldsId = null;
    switch (category) {
      case 'ToRead':
        fieldsId = 'category-toread-fields';
        break;
      case 'Reading':
        fieldsId = 'category-reading-fields';
        break;
      case 'AlmostFinished':
        fieldsId = 'category-almostfinished-fields';
        // AlmostFinished 안내 메시지 표시
        this.showAlmostFinishedInfoMessage();
        // 실시간 검증 이벤트 리스너 설정
        this.setupAlmostFinishedProgressValidation();
        break;
      case 'Finished':
        fieldsId = 'category-finished-fields';
        // Finished 카테고리 선택 시 별점 입력 초기화
        const ratingGroup = document.getElementById('rating-group');
        const ratingStarsInput = document.getElementById('rating-stars');
        const ratingInput = document.getElementById('rating');
        if (ratingGroup && ratingStarsInput && ratingInput) {
          ratingGroup.style.display = 'block';
          this.initRatingStarsInput(ratingStarsInput, ratingInput);
        }
        break;
    }
    
    if (fieldsId) {
      const fields = document.getElementById(fieldsId);
      if (fields) {
        fields.style.display = 'block';
      }
    }
    
    // 진행률 힌트 업데이트
    this.updateProgressHints();
    
    // AlmostFinished가 아닌 경우 안내 메시지 및 검증 메시지 숨김
    if (category !== 'AlmostFinished') {
      this.hideAlmostFinishedInfoMessage();
      this.hideAlmostFinishedValidationMessage();
    }
  }
  
  /**
   * AlmostFinished 안내 메시지 표시
   */
  showAlmostFinishedInfoMessage() {
    const infoMessage = document.getElementById('almostfinished-info-message');
    if (infoMessage) {
      infoMessage.style.display = 'flex';
    }
  }
  
  /**
   * AlmostFinished 안내 메시지 숨김
   */
  hideAlmostFinishedInfoMessage() {
    const infoMessage = document.getElementById('almostfinished-info-message');
    if (infoMessage) {
      infoMessage.style.display = 'none';
    }
  }
  
  /**
   * AlmostFinished 진행률 실시간 검증 설정
   */
  setupAlmostFinishedProgressValidation() {
    const progressInput = document.getElementById('reading-progress-af');
    if (!progressInput) return;
    
    // 기존 이벤트 리스너 제거 (중복 방지)
    const existingHandler = this.almostFinishedProgressHandler;
    if (existingHandler) {
      progressInput.removeEventListener('input', existingHandler);
      progressInput.removeEventListener('blur', existingHandler);
    }
    
    // 새로운 이벤트 핸들러 생성
    this.almostFinishedProgressHandler = () => {
      this.validateAlmostFinishedProgress();
    };
    
    // 이벤트 리스너 등록
    progressInput.addEventListener('input', this.almostFinishedProgressHandler);
    progressInput.addEventListener('blur', this.almostFinishedProgressHandler);
    
    // 이벤트 리스너 추적
    this.eventListeners.push(
      { element: progressInput, event: 'input', handler: this.almostFinishedProgressHandler },
      { element: progressInput, event: 'blur', handler: this.almostFinishedProgressHandler }
    );
  }
  
  /**
   * AlmostFinished 진행률 실시간 검증
   */
  validateAlmostFinishedProgress() {
    const progressInput = document.getElementById('reading-progress-af');
    const validationMessage = document.getElementById('reading-progress-af-validation');
    const totalPages = this.bookDetail?.totalPages;
    
    if (!progressInput || !validationMessage || !totalPages) {
      return;
    }
    
    const inputValue = progressInput.value.trim();
    if (!inputValue) {
      this.hideAlmostFinishedValidationMessage();
      return;
    }
    
    const progress = parseInt(inputValue, 10);
    if (isNaN(progress) || progress < 0) {
      this.hideAlmostFinishedValidationMessage();
      return;
    }
    
    // 진행률 계산
    const progressPercentage = (progress / totalPages) * 100;
    const minProgress = Math.ceil(totalPages * 0.81);
    const maxProgress = Math.floor(totalPages * 0.99);
    
    // 81~99% 범위 검증
    if (progress < minProgress || progress > maxProgress) {
      validationMessage.style.display = 'block';
      validationMessage.className = 'validation-message validation-error';
      if (progress < minProgress) {
        validationMessage.textContent = `⚠️ 진행률이 81% 미만입니다. (권장: ${minProgress}페이지 이상)`;
      } else if (progress > maxProgress) {
        validationMessage.textContent = `⚠️ 진행률이 99%를 초과합니다. (권장: ${maxProgress}페이지 이하)`;
      }
    } else {
      validationMessage.style.display = 'block';
      validationMessage.className = 'validation-message validation-success';
      validationMessage.textContent = `✓ 진행률 ${Math.round(progressPercentage)}% (거의 다 읽음 범위: 81~99%)`;
    }
  }
  
  /**
   * AlmostFinished 검증 메시지 숨김
   */
  hideAlmostFinishedValidationMessage() {
    const validationMessage = document.getElementById('reading-progress-af-validation');
    if (validationMessage) {
      validationMessage.style.display = 'none';
    }
  }
  
  /**
   * 진행률 힌트 업데이트
   */
  updateProgressHints() {
    const totalPages = this.bookDetail?.totalPages;
    if (!totalPages) return;
    
    const hints = [
      document.getElementById('reading-progress-hint'),
      document.getElementById('reading-progress-af-hint')
    ];
    
    hints.forEach(hint => {
      if (hint) {
        hint.textContent = `전체 ${totalPages}페이지 중`;
      }
    });
  }
  
  /**
   * 폼 검증
   * @param {string} category - 선택된 카테고리
   * @param {Object} formData - 폼 데이터
   * @returns {Object} { valid: boolean, errors: string[] }
   */
  validateForm(category, formData) {
    const errors = [];
    
    switch (category) {
      case 'ToRead':
        // 필수 필드 없음
        if (formData.expectation && formData.expectation.length > 500) {
          errors.push('기대평은 최대 500자까지 입력 가능합니다.');
        }
        break;
        
      case 'Reading':
        if (!formData.readingStartDate) {
          errors.push('독서 시작일을 입력해주세요.');
        }
        if (formData.readingProgress === null || formData.readingProgress === undefined) {
          errors.push('현재 읽은 페이지 수를 입력해주세요.');
        } else {
          // 이미 collectFormData()에서 parseInt 처리되었으므로 숫자 타입 확인
          const progress = typeof formData.readingProgress === 'number' ? formData.readingProgress : parseInt(formData.readingProgress, 10);
          if (isNaN(progress) || !isFinite(progress)) {
            errors.push('읽은 페이지 수는 유효한 숫자여야 합니다.');
          } else {
            const totalPages = this.bookDetail?.totalPages;
            if (progress < 0) {
              errors.push('페이지 수는 0 이상이어야 합니다.');
            } else if (totalPages && progress > totalPages) {
              errors.push(`페이지 수는 전체 페이지 수(${totalPages}페이지)를 초과할 수 없습니다.`);
            }
          }
        }
        break;
        
      case 'AlmostFinished':
        if (!formData.readingStartDate) {
          errors.push('독서 시작일을 입력해주세요.');
        }
        if (formData.readingProgress === null || formData.readingProgress === undefined) {
          errors.push('현재 읽은 페이지 수를 입력해주세요.');
        } else {
          // 이미 collectFormData()에서 parseInt 처리되었으므로 숫자 타입 확인
          const progress = typeof formData.readingProgress === 'number' ? formData.readingProgress : parseInt(formData.readingProgress, 10);
          if (isNaN(progress) || !isFinite(progress)) {
            errors.push('읽은 페이지 수는 유효한 숫자여야 합니다.');
          } else {
            const totalPages = this.bookDetail?.totalPages;
            if (progress < 0) {
              errors.push('페이지 수는 0 이상이어야 합니다.');
            } else if (totalPages && progress > totalPages) {
              errors.push(`페이지 수는 전체 페이지 수(${totalPages}페이지)를 초과할 수 없습니다.`);
            } else if (totalPages) {
              // AlmostFinished 카테고리는 81~99% 범위 검증
              const progressPercentage = (progress / totalPages) * 100;
              const minProgress = Math.ceil(totalPages * 0.81);
              const maxProgress = Math.floor(totalPages * 0.99);
              
              if (progress < minProgress || progress > maxProgress) {
                errors.push(`거의 다 읽음 카테고리는 독서 진행률 81~99%일 때 설정됩니다. (권장: ${minProgress}~${maxProgress}페이지)`);
              }
            }
          }
        }
        break;
        
      case 'Finished':
        if (!formData.readingStartDate) {
          errors.push('독서 시작일을 입력해주세요.');
        }
        if (!formData.readingFinishedDate) {
          errors.push('독서 종료일을 입력해주세요.');
        } else if (formData.readingStartDate && formData.readingFinishedDate) {
          const startDate = new Date(formData.readingStartDate);
          const finishedDate = new Date(formData.readingFinishedDate);
          if (finishedDate < startDate) {
            errors.push('독서 종료일은 독서 시작일 이후여야 합니다.');
          }
        }
        if (!formData.rating || formData.rating < 1 || formData.rating > 5) {
          errors.push('평점을 1~5 사이로 선택해주세요.');
        }
        break;
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * 폼 데이터 수집
   * @returns {Object} 폼 데이터
   */
  collectFormData() {
    const category = document.getElementById('category-select')?.value;
    const formData = { category };
    
    switch (category) {
      case 'ToRead':
        formData.expectation = document.getElementById('expectation')?.value?.trim() || null;
        break;
        
      case 'Reading':
        formData.readingStartDate = document.getElementById('reading-start-date')?.value || null;
        const progressValue = document.getElementById('reading-progress')?.value;
        if (progressValue && progressValue.trim() !== '') {
          const parsedProgress = parseInt(progressValue, 10);
          // NaN이 아니고 유효한 숫자인 경우에만 설정
          formData.readingProgress = (!isNaN(parsedProgress) && isFinite(parsedProgress)) ? parsedProgress : null;
        } else {
          formData.readingProgress = null;
        }
        const purchaseTypeValue = document.getElementById('purchase-type')?.value;
        formData.purchaseType = (purchaseTypeValue && purchaseTypeValue.trim() !== '') ? purchaseTypeValue : null;
        break;
        
      case 'AlmostFinished':
        formData.readingStartDate = document.getElementById('reading-start-date-af')?.value || null;
        const progressAfValue = document.getElementById('reading-progress-af')?.value;
        if (progressAfValue && progressAfValue.trim() !== '') {
          const parsedProgress = parseInt(progressAfValue, 10);
          // NaN이 아니고 유효한 숫자인 경우에만 설정
          formData.readingProgress = (!isNaN(parsedProgress) && isFinite(parsedProgress)) ? parsedProgress : null;
        } else {
          formData.readingProgress = null;
        }
        break;
        
      case 'Finished':
        formData.readingStartDate = document.getElementById('reading-start-date-f')?.value || null;
        formData.readingFinishedDate = document.getElementById('reading-finished-date')?.value || null;
        const ratingValue = document.getElementById('rating')?.value;
        formData.rating = (ratingValue && ratingValue.trim() !== '') ? parseInt(ratingValue, 10) : null;
        const reviewValue = document.getElementById('review')?.value?.trim();
        formData.review = (reviewValue && reviewValue !== '') ? reviewValue : null;
        // Finished 카테고리는 readingProgress를 전체 페이지 수로 자동 설정
        if (this.bookDetail?.totalPages) {
          formData.readingProgress = this.bookDetail.totalPages;
        }
        break;
    }
    
    return formData;
  }
  
  /**
   * 폼 제출 및 API 호출
   */
  async submitAddToShelfForm() {
    const category = document.getElementById('category-select')?.value;
    if (!category) {
      alert('독서 상태를 선택해주세요.');
      return;
    }
    
    // 폼 데이터 수집
    const formData = this.collectFormData();
    
    // 검증
    const validation = this.validateForm(category, formData);
    if (!validation.valid) {
      alert(validation.errors.join('\n'));
      return;
    }
    
    // 제출 버튼 비활성화
    const submitBtn = document.getElementById('modal-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '저장 중...';
    }
    
    try {
      // API 요청 데이터 구성
      const requestData = {
        isbn: this.bookDetail.isbn,
        title: this.bookDetail.title,
        author: this.bookDetail.author || '',
        publisher: this.bookDetail.publisher || '',
        pubDate: this.bookDetail.pubDate || null,
        description: this.bookDetail.description || null,
        coverUrl: this.bookDetail.coverUrl || this.bookDetail.coverImageUrl || null,
        totalPages: this.bookDetail.totalPages || null,
        mainGenre: this.bookDetail.mainGenre || null,
        category: formData.category,
        // 카테고리별 필드 (빈 문자열은 null로 변환)
        expectation: formData.expectation || null,
        readingStartDate: formData.readingStartDate || null,
        // readingProgress는 0도 유효한 값이므로 명시적으로 null 체크
        readingProgress: (formData.readingProgress !== null && formData.readingProgress !== undefined) ? formData.readingProgress : null,
        purchaseType: (formData.purchaseType && formData.purchaseType.trim() !== '') ? formData.purchaseType : null,
        readingFinishedDate: formData.readingFinishedDate || null,
        rating: formData.rating || null,
        review: formData.review || null
      };
      
      // 서재에 추가
      const response = await bookService.addBookToShelf(requestData);
      
      // 서재 목록 갱신을 위한 이벤트 발행
      // bookState.addBook()을 호출하지 않음 - loadBookshelf()에서 서버 데이터를 조회하므로 중복 방지
      eventBus.publish(BOOK_EVENTS.BOOKSHELF_UPDATED, {
        timestamp: new Date(),
      });
      
      // 성공 메시지
      alert(`"${this.bookDetail.title}"이(가) 서재에 추가되었습니다.`);
      
      // 모달 닫기
      this.hideAddToShelfModal();
      
      // 버튼 텍스트 변경
      const btnAddToShelf = document.getElementById('btn-add-to-shelf');
      if (btnAddToShelf) {
        btnAddToShelf.textContent = '서재에 추가됨';
        btnAddToShelf.classList.add('btn-success');
      }
      
    } catch (error) {
      console.error('서재 추가 오류:', error);
      
      // 중복 저장 에러 확인 (에러 코드 또는 메시지로 확인)
      // 백엔드에서 발생할 수 있는 중복 관련 에러 메시지:
      // 1. "이미 내 서재에 추가된 책입니다." - 같은 사용자가 같은 책을 중복 추가 (user_books 테이블 중복)
      const errorMessage = error.message || '';
      const isDuplicateError = error.code === 'DUPLICATE_BOOK' || 
                               (error.status === 400 && (
                                 errorMessage.includes('이미') && 
                                 (errorMessage.includes('서재') || 
                                  errorMessage.includes('추가') || 
                                  errorMessage.includes('책') ||
                                  errorMessage.includes('ISBN') ||
                                  errorMessage.includes('Book 테이블'))
                               ));
      
      if (isDuplicateError) {
        // 중복 저장 시 사용자 친화적 메시지 표시
        alert('이미 서재에 있는 책입니다.');
        this.hideAddToShelfModal();
        const btnAddToShelf = document.getElementById('btn-add-to-shelf');
        if (btnAddToShelf) {
          btnAddToShelf.textContent = '서재에 추가됨';
          btnAddToShelf.classList.add('btn-success');
        }
      } else {
        alert('서재 추가 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = '저장';
        }
      }
    }
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
   * 도서 상세 정보 표시
   */
  showBookDetail() {
    if (this.bookDetailSection) {
      this.bookDetailSection.style.display = 'block';
    }
    if (this.errorSection) {
      this.errorSection.style.display = 'none';
    }
  }

  /**
   * 도서 상세 정보 숨김
   */
  hideBookDetail() {
    if (this.bookDetailSection) {
      this.bookDetailSection.style.display = 'none';
    }
  }

  /**
   * 뒤로가기 처리
   * 브라우저 히스토리를 사용하여 바로 이전 화면으로 이동
   */
  handleBack(e) {
    // 이벤트가 전달된 경우 기본 동작 방지
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // 브라우저 히스토리를 사용하여 바로 이전 화면으로 이동
    window.history.back();
  }

  /**
   * 에러 섹션 뒤로가기 처리
   */
  handleErrorBack() {
    window.history.back();
  }

  /**
   * 에러 메시지 표시
   * @param {string} message - 에러 메시지
   */
  showError(message) {
    if (this.errorSection) {
      this.errorSection.style.display = 'block';
      const errorTextEl = document.getElementById('error-text');
      if (errorTextEl) {
        errorTextEl.textContent = message;
      }
    }
    if (this.bookDetailSection) {
      this.bookDetailSection.style.display = 'none';
    }
    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = 'none';
    }
  }

  /**
   * 에러 메시지 숨김
   */
  hideError() {
    if (this.errorSection) {
      this.errorSection.style.display = 'none';
    }
  }
  
  /**
   * 독서 시작하기 모달 표시 및 초기화
   */
  showStartReadingModal() {
    if (!this.startReadingModal) {
      this.startReadingModal = document.getElementById('start-reading-modal');
    }
    
    if (!this.startReadingModal) {
      console.error('독서 시작하기 모달을 찾을 수 없습니다.');
      alert('모달을 불러올 수 없습니다. 페이지를 새로고침해주세요.');
      return;
    }
    
    // 모달 표시
    this.startReadingModal.style.display = 'flex';
    setTimeout(() => {
      this.startReadingModal.classList.add('show');
    }, 10);
    
    // 오늘 날짜를 기본값으로 설정
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('start-reading-date');
    if (dateInput) {
      dateInput.value = today; // 항상 오늘 날짜로 설정
    }
    
    // ToRead에서 변경한 것이므로 마지막으로 읽은 페이지 수는 자동으로 1로 설정
    // 이후 사용자가 수정할 수 있음
    const progressInput = document.getElementById('start-reading-progress');
    if (progressInput) {
      progressInput.value = '1'; // 기본값 1로 설정
    }
    
    // 구매/대여 여부는 빈 값으로 설정 (선택사항)
    const purchaseTypeSelect = document.getElementById('start-reading-purchase-type');
    if (purchaseTypeSelect) {
      purchaseTypeSelect.value = '';
    }
    
    // 진행률 힌트 업데이트
    this.updateStartReadingProgressHint();
    
    // 진행률 입력 필드에 이벤트 리스너 추가 (전체 페이지 수 확인용)
    // 기존 리스너 제거 후 새로 추가 (중복 방지)
    if (progressInput) {
      // 기존 리스너가 있다면 제거 (progressInput에 저장된 핸들러 참조 사용)
      if (this.progressInputHandler) {
        progressInput.removeEventListener('input', this.progressInputHandler);
        // eventListeners 배열에서도 제거
        this.eventListeners = this.eventListeners.filter(
          listener => !(listener.element === progressInput && listener.event === 'input')
        );
      }
      
      const handleProgressChange = () => {
        this.updateStartReadingProgressHint();
      };
      this.progressInputHandler = handleProgressChange; // 참조 저장
      progressInput.addEventListener('input', handleProgressChange);
      // eventListeners 배열에 추가하여 destroy()에서 정리 가능하도록
      this.eventListeners.push({ element: progressInput, event: 'input', handler: handleProgressChange });
    }
    
    // 모달 버튼 이벤트 리스너 재확인 (모달이 표시될 때마다)
    this.setupStartReadingModalListeners();
  }
  
  /**
   * 독서 시작하기 모달 이벤트 리스너 설정
   */
  setupStartReadingModalListeners() {
    const startReadingModalCloseBtn = document.getElementById('start-reading-modal-close-btn');
    const startReadingModalSubmitBtn = document.getElementById('start-reading-modal-submit-btn');
    
    // 기존 리스너 제거 (중복 방지)
    if (startReadingModalCloseBtn) {
      // 기존 핸들러 찾아서 제거
      const existingCloseHandler = startReadingModalCloseBtn._closeHandler;
      if (existingCloseHandler) {
        startReadingModalCloseBtn.removeEventListener('click', existingCloseHandler);
      }
      
      const handleClose = () => {
        this.hideStartReadingModal();
      };
      startReadingModalCloseBtn._closeHandler = handleClose;
      startReadingModalCloseBtn.addEventListener('click', handleClose);
      
      // eventListeners 배열 업데이트
      this.eventListeners = this.eventListeners.filter(
        listener => !(listener.element === startReadingModalCloseBtn && listener.event === 'click')
      );
      this.eventListeners.push({ element: startReadingModalCloseBtn, event: 'click', handler: handleClose });
    }
    
    // 제출 버튼
    if (startReadingModalSubmitBtn) {
      const existingSubmitHandler = startReadingModalSubmitBtn._submitHandler;
      if (existingSubmitHandler) {
        startReadingModalSubmitBtn.removeEventListener('click', existingSubmitHandler);
      }
      
      const handleSubmit = () => {
        this.submitStartReadingForm();
      };
      startReadingModalSubmitBtn._submitHandler = handleSubmit;
      startReadingModalSubmitBtn.addEventListener('click', handleSubmit);
      
      this.eventListeners = this.eventListeners.filter(
        listener => !(listener.element === startReadingModalSubmitBtn && listener.event === 'click')
      );
      this.eventListeners.push({ element: startReadingModalSubmitBtn, event: 'click', handler: handleSubmit });
    }
    
    // 모달 외부 클릭 시 닫기
    if (this.startReadingModal) {
      const existingModalClickHandler = this.startReadingModal._modalClickHandler;
      if (existingModalClickHandler) {
        this.startReadingModal.removeEventListener('click', existingModalClickHandler);
      }
      
      const handleModalClick = (e) => {
        if (e.target === this.startReadingModal) {
          this.hideStartReadingModal();
        }
      };
      this.startReadingModal._modalClickHandler = handleModalClick;
      this.startReadingModal.addEventListener('click', handleModalClick);
      
      this.eventListeners = this.eventListeners.filter(
        listener => !(listener.element === this.startReadingModal && listener.event === 'click')
      );
      this.eventListeners.push({ element: this.startReadingModal, event: 'click', handler: handleModalClick });
    }
  }

  /**
   * 독서 시작하기 모달 닫기
   */
  hideStartReadingModal() {
    if (this.startReadingModal) {
      this.startReadingModal.classList.remove('show');
      setTimeout(() => {
        this.startReadingModal.style.display = 'none';
      }, 200);
    }
    
    // 폼 초기화
    const form = document.getElementById('start-reading-form');
    if (form) {
      form.reset();
    }
    
    // 진행률 입력 필드 핸들러 참조 초기화
    this.progressInputHandler = null;
  }

  /**
   * 독서 시작하기 진행률 힌트 업데이트
   */
  updateStartReadingProgressHint() {
    const progressInput = document.getElementById('start-reading-progress');
    const hintEl = document.getElementById('start-reading-progress-hint');
    
    if (!progressInput || !hintEl) return;
    
    const progress = parseInt(progressInput.value) || 0;
    const totalPages = this.bookDetail?.totalPages;
    
    if (totalPages && totalPages > 0) {
      if (progress > totalPages) {
        hintEl.textContent = `⚠️ 전체 페이지 수(${totalPages}페이지)를 초과할 수 없습니다.`;
        hintEl.style.color = 'var(--color-error)';
      } else {
        const percentage = Math.round((progress / totalPages) * 100);
        hintEl.textContent = `전체 ${totalPages}페이지 중 ${progress}페이지 (${percentage}%)`;
        hintEl.style.color = 'var(--color-text-secondary)';
      }
    } else {
      hintEl.textContent = '';
    }
  }

  /**
   * 독서 시작하기 폼 제출
   */
  async submitStartReadingForm() {
    const readingStartDate = document.getElementById('start-reading-date')?.value;
    const readingProgress = document.getElementById('start-reading-progress')?.value;
    const purchaseType = document.getElementById('start-reading-purchase-type')?.value;
    
    // 필수 필드 검증
    if (!readingStartDate) {
      alert('독서 시작일을 입력해주세요.');
      return;
    }
    
    if (!readingProgress || readingProgress.trim() === '') {
      alert('현재 읽은 페이지 수를 입력해주세요.');
      return;
    }
    
    const progressNum = parseInt(readingProgress);
    if (isNaN(progressNum) || progressNum < 0) {
      alert('읽은 페이지 수는 0 이상의 숫자여야 합니다.');
      return;
    }
    
    // 전체 페이지 수 확인
    const totalPages = this.bookDetail?.totalPages;
    if (totalPages && totalPages > 0 && progressNum > totalPages) {
      alert(`읽은 페이지 수는 전체 페이지 수(${totalPages}페이지)를 초과할 수 없습니다.`);
      return;
    }
    
    // 제출 버튼 비활성화
    const submitBtn = document.getElementById('start-reading-modal-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '처리 중...';
    }
    
    try {
      // API 요청 데이터 구성
      const requestData = {
        readingStartDate: readingStartDate,
        readingProgress: progressNum,
      };
      
      // 구매 유형이 선택된 경우에만 추가
      if (purchaseType && purchaseType.trim() !== '') {
        requestData.purchaseType = purchaseType;
      }
      
      // 독서 시작하기 API 호출
      await bookService.startReading(this.userBookId, requestData);
      
      // 상태 업데이트 (Event-Driven 패턴)
      // 카테고리가 ToRead → Reading으로 변경됨
      bookState.updateBookStatus(this.userBookId, {
        category: 'Reading',
        readingStartDate: readingStartDate,
        readingProgress: progressNum,
        purchaseType: purchaseType || null,
      });
      
      // 서재 목록 갱신을 위한 이벤트 발행
      eventBus.publish(BOOK_EVENTS.BOOKSHELF_UPDATED, {
        timestamp: new Date(),
      });
      
      // 성공 메시지
      alert('독서를 시작했습니다.');
      
      // 모달 닫기
      this.hideStartReadingModal();
      
      // 도서 상세 정보 다시 로드 (카테고리가 Reading으로 변경됨)
      await this.loadUserBookDetail();
      
    } catch (error) {
      console.error('독서 시작 오류:', error);
      alert('독서 시작 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '시작하기';
      }
    }
  }

  /**
   * 읽은 페이지 수 표시 업데이트
   * @param {number} currentPages - 현재 읽은 페이지 수
   * @param {number|null} totalPages - 전체 페이지 수
   * @param {HTMLElement} readingProgressEl - 표시할 요소
   */
  updateReadingProgressDisplay(currentPages, totalPages, readingProgressEl) {
    if (readingProgressEl) {
      if (totalPages) {
        readingProgressEl.textContent = `${currentPages}쪽 / ${totalPages}쪽`;
      } else {
        readingProgressEl.textContent = `${currentPages}쪽`;
      }
    }
  }

  /**
   * 진행률 게이지 바 업데이트
   * @param {number} currentPages - 현재 읽은 페이지 수
   * @param {number} totalPages - 전체 페이지 수
   * @param {HTMLElement} progressBarContainer - 게이지 바 컨테이너
   * @param {HTMLElement} progressBarFill - 게이지 바 채우기 요소
   * @param {HTMLElement} progressPercentage - 퍼센티지 텍스트 요소
   */
  updateProgressBar(currentPages, totalPages, progressBarContainer, progressBarFill, progressPercentage) {
    if (!totalPages || totalPages <= 0) return;
    
    // 진행률 계산 (퍼센티지)
    const percentage = Math.min(100, Math.max(0, Math.round((currentPages / totalPages) * 100)));
    
    // 게이지 바 표시
    if (progressBarContainer) {
      progressBarContainer.style.display = 'flex';
    }
    
    // 게이지 바 채우기
    if (progressBarFill) {
      progressBarFill.style.width = `${percentage}%`;
    }
    
    // 퍼센티지 텍스트 표시
    if (progressPercentage) {
      progressPercentage.textContent = `${percentage}%`;
    }
  }

  /**
   * 읽은 페이지 수 편집 모드 시작
   */
  handleEditProgress() {
    const readingProgressInput = document.getElementById('user-book-reading-progress-input');
    const readingProgressEl = document.getElementById('user-book-reading-progress');
    const btnEditProgress = document.getElementById('btn-edit-progress');
    const btnSaveProgress = document.getElementById('btn-save-progress');
    const btnCancelProgress = document.getElementById('btn-cancel-progress');
    
    if (!readingProgressInput || !readingProgressEl) return;
    
    // 현재 값 가져오기
    const currentValue = this.userBookDetail.readingProgress || 0;
    
    // 입력 필드에 현재 값 설정
    readingProgressInput.value = currentValue;
    readingProgressInput.max = this.bookDetail?.totalPages || this.userBookDetail.totalPages || '';
    
    // UI 전환: 표시 → 편집 모드
    readingProgressEl.style.display = 'none';
    btnEditProgress.style.display = 'none';
    readingProgressInput.style.display = 'inline-block';
    btnSaveProgress.style.display = 'inline-block';
    btnCancelProgress.style.display = 'inline-block';
    
    // 입력 필드에 포커스
    readingProgressInput.focus();
    readingProgressInput.select();
    
    // 원본 값 저장 (취소 시 복원용)
    this.originalProgressValue = currentValue;
  }

  /**
   * 읽은 페이지 수 입력 변경 시 실시간 진행률 업데이트
   */
  handleProgressInputChange() {
    const readingProgressInput = document.getElementById('user-book-reading-progress-input');
    const progressBarContainer = document.getElementById('reading-progress-bar-container');
    const progressBarFill = document.getElementById('reading-progress-bar-fill');
    const progressPercentage = document.getElementById('reading-progress-percentage');
    
    if (!readingProgressInput) return;
    
    const inputValue = parseInt(readingProgressInput.value, 10);
    const totalPages = this.bookDetail?.totalPages || this.userBookDetail.totalPages;
    
    // 유효한 숫자인 경우에만 진행률 업데이트
    if (!isNaN(inputValue) && isFinite(inputValue) && totalPages && totalPages > 0) {
      // 현재 읽은 페이지 수는 전체 페이지 수를 초과할 수 없음
      const validValue = Math.max(0, Math.min(inputValue, totalPages));
      
      // 입력값이 전체 페이지 수를 초과하는 경우 입력값을 제한
      if (inputValue > totalPages) {
        readingProgressInput.value = totalPages;
      }
      
      this.updateProgressBar(validValue, totalPages, progressBarContainer, progressBarFill, progressPercentage);
    }
  }

  /**
   * 읽은 페이지 수 저장
   */
  async handleSaveProgress() {
    const readingProgressInput = document.getElementById('user-book-reading-progress-input');
    const btnSaveProgress = document.getElementById('btn-save-progress');
    
    if (!readingProgressInput || !this.userBookId) return;
    
    const inputValue = readingProgressInput.value.trim();
    if (!inputValue) {
      alert('읽은 페이지 수를 입력해주세요.');
      return;
    }
    
    const progressNum = parseInt(inputValue, 10);
    if (isNaN(progressNum) || progressNum < 0) {
      alert('읽은 페이지 수는 0 이상의 숫자여야 합니다.');
      return;
    }
    
    // 전체 페이지 수 확인
    const totalPages = this.bookDetail?.totalPages || this.userBookDetail.totalPages;
    if (totalPages && totalPages > 0) {
      // 현재 읽은 페이지 수는 전체 페이지 수를 초과할 수 없음
      if (progressNum > totalPages) {
        alert(`읽은 페이지 수는 전체 페이지 수(${totalPages}페이지)를 초과할 수 없습니다.`);
        return;
      }
    }
    
    // 저장 버튼 비활성화
    if (btnSaveProgress) {
      btnSaveProgress.disabled = true;
      btnSaveProgress.textContent = '저장 중...';
    }
    
    try {
      // 이전 카테고리 저장 (변경 여부 확인용)
      const previousCategory = this.userBookDetail.category;
      
      // Finished로 변경될 가능성이 있는지 확인 (진행률이 전체 페이지 수와 정확히 같은 경우만)
      const totalPages = this.bookDetail?.totalPages || this.userBookDetail.totalPages;
      const willBecomeFinished = totalPages && totalPages > 0 && progressNum === totalPages;
      
      // 다른 카테고리에서 Finished로 변경될 경우 확인 알림 표시
      // (단, 이미 Finished 카테고리이거나 "내 서재에 저장하기"에서 Finished를 선택한 경우는 제외)
      if (willBecomeFinished && previousCategory !== 'Finished' && 
          (previousCategory === 'ToRead' || previousCategory === 'Reading' || previousCategory === 'AlmostFinished')) {
        const confirmed = confirm(
          `읽은 페이지 수가 전체 페이지 수(${totalPages}페이지)와 같습니다.\n` +
          `이 책을 완독(Finished) 카테고리로 변경하시겠습니까?\n\n` +
          `완독으로 변경하면 더 이상 읽은 페이지 수를 수정할 수 없습니다.`
        );
        
        if (!confirmed) {
          // 사용자가 '아니오'를 선택한 경우 변경 취소
          if (btnSaveProgress) {
            btnSaveProgress.disabled = false;
            btnSaveProgress.textContent = '저장';
          }
          // 편집 모드 유지 (취소하지 않음, 사용자가 다시 수정할 수 있도록)
          return;
        }
      }
      
      // API 호출하여 읽은 페이지 수 업데이트
      // 백엔드에서 진행률에 따라 카테고리를 자동으로 변경함
      await bookService.updateBookDetail(this.userBookId, {
        readingProgress: progressNum
      });
      
      // 업데이트된 정보 다시 불러오기 (카테고리 변경 반영)
      const updatedUserBookDetail = await bookService.getUserBookDetail(this.userBookId);
      
      // 백엔드 필드명 매핑
      const mappedUserBookDetail = {
        ...updatedUserBookDetail,
        readingProgress: updatedUserBookDetail.readingProgress !== undefined && updatedUserBookDetail.readingProgress !== null 
          ? updatedUserBookDetail.readingProgress 
          : (updatedUserBookDetail.lastReadPage !== undefined && updatedUserBookDetail.lastReadPage !== null 
              ? updatedUserBookDetail.lastReadPage 
              : null),
        readingStartDate: updatedUserBookDetail.readingStartDate || updatedUserBookDetail.lastReadAt || null,
        totalPages: updatedUserBookDetail.totalPages || null,
      };
      
      // 로컬 상태 업데이트
      this.userBookDetail = mappedUserBookDetail;
      
      // UI 업데이트 (전체 정보 다시 표시)
      this.displayUserBookDetail(this.bookDetail, this.userBookDetail);
      
      // 편집 모드 종료
      this.exitEditProgressMode();
      
      // 카테고리 변경 알림 및 처리
      const newCategory = mappedUserBookDetail.category;
      if (previousCategory !== newCategory) {
        // 서재 목록 갱신을 위한 이벤트 발행 (카테고리 변경 시)
        eventBus.publish(BOOK_EVENTS.BOOKSHELF_UPDATED, {
          timestamp: new Date(),
        });
        
        const categoryLabels = {
          'ToRead': '읽을 예정',
          'Reading': '읽는 중',
          'AlmostFinished': '거의 다 읽음',
          'Finished': '완독',
        };
        const previousLabel = categoryLabels[previousCategory] || previousCategory;
        const newLabel = categoryLabels[newCategory] || newCategory;
        
        // Finished 카테고리로 변경된 경우 평점/후기 입력 모달 표시
        if (newCategory === 'Finished' && previousCategory !== 'Finished') {
          // 모달 표시 (평점은 필수, 후기는 선택)
          this.showFinishReadingModal();
        } else {
          alert(`읽은 페이지 수가 업데이트되었습니다.\n카테고리가 "${previousLabel}"에서 "${newLabel}"로 변경되었습니다.`);
        }
      } else {
        alert('읽은 페이지 수가 업데이트되었습니다.');
      }
      
    } catch (error) {
      console.error('읽은 페이지 수 업데이트 오류:', error);
      alert('읽은 페이지 수 업데이트 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
    } finally {
      // 저장 버튼 활성화
      if (btnSaveProgress) {
        btnSaveProgress.disabled = false;
        btnSaveProgress.textContent = '저장';
      }
    }
  }

  /**
   * 읽은 페이지 수 편집 취소
   */
  handleCancelProgress() {
    this.exitEditProgressMode();
    
    // 진행률 게이지 바를 원래 값으로 복원
    const originalValue = this.originalProgressValue || this.userBookDetail.readingProgress || 0;
    const totalPages = this.bookDetail?.totalPages || this.userBookDetail.totalPages;
    const progressBarContainer = document.getElementById('reading-progress-bar-container');
    const progressBarFill = document.getElementById('reading-progress-bar-fill');
    const progressPercentage = document.getElementById('reading-progress-percentage');
    
    if (totalPages && totalPages > 0) {
      this.updateProgressBar(originalValue, totalPages, progressBarContainer, progressBarFill, progressPercentage);
    }
    
    this.originalProgressValue = null;
  }

  /**
   * 구매/대여 여부 변경 처리 (저장 버튼 표시)
   */
  handlePurchaseTypeChange() {
    const btnSavePurchaseType = document.getElementById('btn-save-purchase-type');
    const btnCancelPurchaseType = document.getElementById('btn-cancel-purchase-type');
    
    // 저장/취소 버튼 표시
    if (btnSavePurchaseType) {
      btnSavePurchaseType.style.display = 'inline-block';
    }
    if (btnCancelPurchaseType) {
      btnCancelPurchaseType.style.display = 'inline-block';
    }
  }

  /**
   * 구매/대여 여부 저장
   */
  async handleSavePurchaseType() {
    const purchaseTypeSelect = document.getElementById('user-book-purchase-type-select');
    const btnSavePurchaseType = document.getElementById('btn-save-purchase-type');
    
    if (!purchaseTypeSelect || !this.userBookId) return;
    
    const purchaseType = purchaseTypeSelect.value || null;
    
    // 저장 버튼 비활성화
    if (btnSavePurchaseType) {
      btnSavePurchaseType.disabled = true;
      btnSavePurchaseType.textContent = '저장 중...';
    }
    
    try {
      // API 호출하여 구매/대여 여부 업데이트
      await bookService.updateBookDetail(this.userBookId, {
        purchaseType: purchaseType,
      });
      
      // 성공 메시지
      alert('구매/대여 여부가 업데이트되었습니다.');
      
      // 도서 상세 정보 다시 로드
      await this.loadUserBookDetail();
      
    } catch (error) {
      console.error('구매/대여 여부 업데이트 오류:', error);
      alert('구매/대여 여부 업데이트 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
      
      // 원래 값으로 복원
      purchaseTypeSelect.value = this.originalPurchaseTypeValue || '';
    } finally {
      // 저장 버튼 활성화 및 숨김
      if (btnSavePurchaseType) {
        btnSavePurchaseType.disabled = false;
        btnSavePurchaseType.textContent = '저장';
        btnSavePurchaseType.style.display = 'none';
      }
      const btnCancelPurchaseType = document.getElementById('btn-cancel-purchase-type');
      if (btnCancelPurchaseType) {
        btnCancelPurchaseType.style.display = 'none';
      }
    }
  }

  /**
   * 구매/대여 여부 변경 취소
   */
  handleCancelPurchaseType() {
    const purchaseTypeSelect = document.getElementById('user-book-purchase-type-select');
    const btnSavePurchaseType = document.getElementById('btn-save-purchase-type');
    const btnCancelPurchaseType = document.getElementById('btn-cancel-purchase-type');
    
    // 원래 값으로 복원
    if (purchaseTypeSelect) {
      purchaseTypeSelect.value = this.originalPurchaseTypeValue || '';
    }
    
    // 저장/취소 버튼 숨김
    if (btnSavePurchaseType) {
      btnSavePurchaseType.style.display = 'none';
    }
    if (btnCancelPurchaseType) {
      btnCancelPurchaseType.style.display = 'none';
    }
  }

  /**
   * 완독 처리 모달 표시 및 초기화
   */
  showFinishReadingModal() {
    if (!this.finishReadingModal) {
      this.finishReadingModal = document.getElementById('finish-reading-modal');
    }
    
    if (!this.finishReadingModal) {
      console.error('완독 처리 모달을 찾을 수 없습니다.');
      return;
    }
    
    // 모달 표시
    this.finishReadingModal.style.display = 'flex';
    setTimeout(() => {
      this.finishReadingModal.classList.add('show');
    }, 10);
    
    // 폼 초기화
    const form = document.getElementById('finish-reading-form');
    if (form) {
      form.reset();
    }
    
    // 독서 종료일을 오늘 날짜로 기본 설정
    const finishedDateInput = document.getElementById('finish-reading-finished-date');
    if (finishedDateInput) {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      finishedDateInput.value = `${year}-${month}-${day}`;
    }
    
    // 별점 입력 초기화
    const ratingStarsInput = document.getElementById('finish-reading-rating-stars');
    const ratingInput = document.getElementById('finish-reading-rating');
    if (ratingStarsInput) {
      this.initRatingStarsInput(ratingStarsInput, ratingInput);
    }
    
    // 이벤트 리스너 설정
    this.setupFinishReadingModalListeners();
  }
  
  /**
   * 완독 처리 모달 이벤트 리스너 설정
   */
  setupFinishReadingModalListeners() {
    const finishReadingModalCloseBtn = document.getElementById('finish-reading-modal-close-btn');
    const finishReadingModalSubmitBtn = document.getElementById('finish-reading-modal-submit-btn');
    
    // 기존 리스너 제거 (중복 방지)
    if (finishReadingModalCloseBtn) {
      // 기존 핸들러 찾아서 제거
      const existingCloseHandler = finishReadingModalCloseBtn._closeHandler;
      if (existingCloseHandler) {
        finishReadingModalCloseBtn.removeEventListener('click', existingCloseHandler);
      }
      
      const handleClose = () => {
        this.hideFinishReadingModal();
      };
      finishReadingModalCloseBtn._closeHandler = handleClose;
      finishReadingModalCloseBtn.addEventListener('click', handleClose);
      
      // eventListeners 배열 업데이트
      this.eventListeners = this.eventListeners.filter(
        listener => !(listener.element === finishReadingModalCloseBtn && listener.event === 'click')
      );
      this.eventListeners.push({ element: finishReadingModalCloseBtn, event: 'click', handler: handleClose });
    }
    
    // 제출 버튼
    if (finishReadingModalSubmitBtn) {
      const existingSubmitHandler = finishReadingModalSubmitBtn._submitHandler;
      if (existingSubmitHandler) {
        finishReadingModalSubmitBtn.removeEventListener('click', existingSubmitHandler);
      }
      
      const handleSubmit = () => {
        this.submitFinishReadingForm();
      };
      finishReadingModalSubmitBtn._submitHandler = handleSubmit;
      finishReadingModalSubmitBtn.addEventListener('click', handleSubmit);
      
      this.eventListeners = this.eventListeners.filter(
        listener => !(listener.element === finishReadingModalSubmitBtn && listener.event === 'click')
      );
      this.eventListeners.push({ element: finishReadingModalSubmitBtn, event: 'click', handler: handleSubmit });
    }
    
    // 모달 외부 클릭 시 닫기
    if (this.finishReadingModal) {
      const existingModalClickHandler = this.finishReadingModal._modalClickHandler;
      if (existingModalClickHandler) {
        this.finishReadingModal.removeEventListener('click', existingModalClickHandler);
      }
      
      const handleModalClick = (e) => {
        if (e.target === this.finishReadingModal) {
          this.hideFinishReadingModal();
        }
      };
      this.finishReadingModal._modalClickHandler = handleModalClick;
      this.finishReadingModal.addEventListener('click', handleModalClick);
      
      this.eventListeners = this.eventListeners.filter(
        listener => !(listener.element === this.finishReadingModal && listener.event === 'click')
      );
      this.eventListeners.push({ element: this.finishReadingModal, event: 'click', handler: handleModalClick });
    }
  }

  /**
   * 완독 처리 모달 닫기
   */
  hideFinishReadingModal() {
    if (this.finishReadingModal) {
      this.finishReadingModal.classList.remove('show');
      setTimeout(() => {
        this.finishReadingModal.style.display = 'none';
      }, 200);
    }
    
    // 폼 초기화
    const form = document.getElementById('finish-reading-form');
    if (form) {
      form.reset();
    }
  }

  /**
   * 완독 처리 폼 제출
   */
  async submitFinishReadingForm() {
    const finishedDateInput = document.getElementById('finish-reading-finished-date');
    const finishedDate = finishedDateInput?.value;
    const ratingInput = document.getElementById('finish-reading-rating');
    const rating = ratingInput?.value;
    const review = document.getElementById('finish-reading-review')?.value;
    
    // 필수 필드 검증
    if (!finishedDate || finishedDate.trim() === '') {
      alert('독서 종료일을 입력해주세요.');
      return;
    }
    
    if (!rating || rating.trim() === '') {
      alert('평점을 선택해주세요.');
      return;
    }
    
    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      alert('평점은 1점부터 5점까지 선택할 수 있습니다.');
      return;
    }
    
    // 제출 버튼 비활성화
    const submitBtn = document.getElementById('finish-reading-modal-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '처리 중...';
    }
    
    try {
      // API 요청 데이터 구성
      const requestData = {
        category: 'Finished',
        readingFinishedDate: finishedDate.trim(),
        rating: ratingNum,
      };
      
      // 후기가 입력된 경우에만 추가
      if (review && review.trim() !== '') {
        requestData.review = review.trim();
      }
      
      // 완독 처리 API 호출 (카테고리, 독서 종료일, 평점 및 후기 업데이트)
      await bookService.updateBookDetail(this.userBookId, requestData);
      
      // 서재 목록 갱신을 위한 이벤트 발행
      eventBus.publish(BOOK_EVENTS.BOOKSHELF_UPDATED, {
        timestamp: new Date(),
      });
      
      // 성공 메시지
      alert('완독 처리가 완료되었습니다.');
      
      // 모달 닫기
      this.hideFinishReadingModal();
      
      // 도서 상세 정보 다시 로드
      await this.loadUserBookDetail();
      
    } catch (error) {
      console.error('완독 처리 오류:', error);
      alert('완독 처리 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 오류'));
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '완료';
      }
    }
  }

  /**
   * 읽은 페이지 수 편집 모드 종료
   */
  exitEditProgressMode() {
    const readingProgressInput = document.getElementById('user-book-reading-progress-input');
    const readingProgressEl = document.getElementById('user-book-reading-progress');
    const btnEditProgress = document.getElementById('btn-edit-progress');
    const btnSaveProgress = document.getElementById('btn-save-progress');
    const btnCancelProgress = document.getElementById('btn-cancel-progress');
    
    // UI 전환: 편집 모드 → 표시
    if (readingProgressInput) {
      readingProgressInput.style.display = 'none';
    }
    if (readingProgressEl) {
      readingProgressEl.style.display = 'inline';
    }
    if (btnEditProgress) {
      btnEditProgress.style.display = 'inline-block';
    }
    if (btnSaveProgress) {
      btnSaveProgress.style.display = 'none';
    }
    if (btnCancelProgress) {
      btnCancelProgress.style.display = 'none';
    }
  }

  /**
   * 별점 표시 (읽기 전용)
   * @param {HTMLElement} container - 별점을 표시할 컨테이너 요소
   * @param {number} rating - 평점 (1-5)
   * @param {boolean} interactive - 클릭 가능 여부 (기본값: false)
   */
  displayRatingStars(container, rating, interactive = false) {
    if (!container) return;
    
    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      container.innerHTML = '';
      return;
    }
    
    let html = '';
    for (let i = 1; i <= 5; i++) {
      const isFilled = i <= ratingNum;
      html += `<span class="star" data-value="${i}">${isFilled ? '★' : '☆'}</span>`;
    }
    
    container.innerHTML = html;
    
    if (interactive) {
      container.classList.add('rating-stars-input');
      container.setAttribute('data-rating', ratingNum);
    } else {
      container.classList.remove('rating-stars-input');
    }
  }

  /**
   * 별점 입력 초기화 및 이벤트 리스너 설정
   * @param {HTMLElement} container - 별점 입력 컨테이너 요소
   * @param {HTMLElement} hiddenInput - 평점 값을 저장할 hidden input 요소
   */
  initRatingStarsInput(container, hiddenInput) {
    if (!container || !hiddenInput) return;
    
    // 초기화: 모든 별을 빈 별로 설정
    container.setAttribute('data-rating', '0');
    container.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
      const star = document.createElement('span');
      star.className = 'star';
      star.setAttribute('data-value', i.toString());
      star.textContent = '☆';
      container.appendChild(star);
    }
    
    // 기존 이벤트 리스너 제거 (중복 방지)
    const existingHandler = container._ratingHandler;
    if (existingHandler) {
      container.removeEventListener('click', existingHandler);
    }
    
    // 클릭 이벤트 핸들러
    const handleStarClick = (e) => {
      const star = e.target.closest('.star');
      if (!star) return;
      
      const value = parseInt(star.getAttribute('data-value'), 10);
      if (isNaN(value) || value < 1 || value > 5) return;
      
      // 별점 업데이트
      this.setRatingStars(container, value);
      
      // hidden input 업데이트
      if (hiddenInput) {
        hiddenInput.value = value.toString();
      }
    };
    
    // 마우스 오버 이벤트 (호버 효과)
    const handleStarHover = (e) => {
      const star = e.target.closest('.star');
      if (!star) {
        // 마우스가 별 영역을 벗어나면 현재 선택된 평점으로 복원
        const currentRating = parseInt(container.getAttribute('data-rating'), 10) || 0;
        this.setRatingStars(container, currentRating);
        return;
      }
      
      const value = parseInt(star.getAttribute('data-value'), 10);
      if (isNaN(value) || value < 1 || value > 5) return;
      
      // 호버 시 미리보기 (실제 선택은 아님)
      this.setRatingStars(container, value, false);
    };
    
    container.addEventListener('click', handleStarClick);
    container.addEventListener('mouseover', handleStarHover);
    container.addEventListener('mouseleave', () => {
      const currentRating = parseInt(container.getAttribute('data-rating'), 10) || 0;
      this.setRatingStars(container, currentRating);
    });
    
    // 핸들러 참조 저장 (나중에 제거하기 위해)
    container._ratingHandler = handleStarClick;
  }

  /**
   * 별점 설정 (내부 메서드)
   * @param {HTMLElement} container - 별점 컨테이너 요소
   * @param {number} rating - 평점 (0-5)
   * @param {boolean} updateDataAttr - data-rating 속성 업데이트 여부 (기본값: true)
   */
  setRatingStars(container, rating, updateDataAttr = true) {
    if (!container) return;
    
    const ratingNum = parseInt(rating, 10);
    if (isNaN(ratingNum) || ratingNum < 0 || ratingNum > 5) {
      ratingNum = 0;
    }
    
    if (updateDataAttr) {
      container.setAttribute('data-rating', ratingNum.toString());
    }
    
    const stars = container.querySelectorAll('.star');
    stars.forEach((star, index) => {
      const value = index + 1;
      if (value <= ratingNum) {
        star.textContent = '★';
        star.style.color = '#ffc107';
      } else {
        star.textContent = '☆';
        star.style.color = '#ddd';
      }
    });
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
    
    // 핸들러 참조 초기화
    this.progressEditHandler = null;
    this.progressInputChangeHandler = null;
    this.originalProgressValue = null;
    this.handleBack = null;
    this.handleErrorBack = null;
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new BookDetailView();
});

export default BookDetailView;


