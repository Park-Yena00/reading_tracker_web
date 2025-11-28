/**
 * 모달 컴포넌트
 * 재사용 가능한 모달 다이얼로그 컴포넌트
 */

export class Modal {
  constructor(options = {}) {
    this.options = {
      title: '',
      content: '',
      size: 'medium', // 'small', 'medium', 'large', 'full'
      showCloseButton: true,
      closeOnOverlayClick: true,
      closeOnEscape: true,
      ...options,
    };
    
    this.element = null;
    this.overlay = null;
    this.isOpen = false;
    this.onClose = null;
    
    this.createModal();
    this.attachEvents();
  }

  /**
   * 모달 요소 생성
   */
  createModal() {
    // 오버레이 생성
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';
    this.overlay.id = `modal-overlay-${Date.now()}`;
    
    // 모달 생성
    this.element = document.createElement('div');
    this.element.className = `modal modal-${this.options.size}`;
    
    // 헤더
    if (this.options.title || this.options.showCloseButton) {
      const header = document.createElement('div');
      header.className = 'modal-header';
      
      if (this.options.title) {
        const title = document.createElement('h2');
        title.className = 'modal-title';
        title.textContent = this.options.title;
        header.appendChild(title);
      }
      
      if (this.options.showCloseButton) {
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close';
        closeButton.setAttribute('aria-label', '닫기');
        closeButton.innerHTML = `
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        `;
        closeButton.addEventListener('click', () => this.close());
        header.appendChild(closeButton);
      }
      
      this.element.appendChild(header);
    }
    
    // 본문
    const body = document.createElement('div');
    body.className = 'modal-body';
    
    if (typeof this.options.content === 'string') {
      body.innerHTML = this.options.content;
    } else if (this.options.content instanceof HTMLElement) {
      body.appendChild(this.options.content);
    }
    
    this.element.appendChild(body);
    
    // 푸터
    if (this.options.footer) {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      
      if (typeof this.options.footer === 'string') {
        footer.innerHTML = this.options.footer;
      } else if (this.options.footer instanceof HTMLElement) {
        footer.appendChild(this.options.footer);
      }
      
      this.element.appendChild(footer);
    }
    
    this.overlay.appendChild(this.element);
  }

  /**
   * 이벤트 리스너 연결
   */
  attachEvents() {
    // 오버레이 클릭 시 닫기
    if (this.options.closeOnOverlayClick) {
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });
    }
    
    // ESC 키로 닫기
    if (this.options.closeOnEscape) {
      this.escapeHandler = (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          this.close();
        }
      };
      document.addEventListener('keydown', this.escapeHandler);
    }
  }

  /**
   * 모달 열기
   * @param {Function} onClose - 닫힐 때 호출될 콜백 함수
   */
  open(onClose) {
    if (this.isOpen) return;
    
    this.onClose = onClose;
    document.body.appendChild(this.overlay);
    document.body.style.overflow = 'hidden'; // 스크롤 방지
    
    // 약간의 지연 후 표시 (애니메이션을 위해)
    setTimeout(() => {
      this.overlay.classList.add('show');
    }, 10);
    
    this.isOpen = true;
  }

  /**
   * 모달 닫기
   */
  close() {
    if (!this.isOpen) return;
    
    this.overlay.classList.remove('show');
    document.body.style.overflow = ''; // 스크롤 복원
    
    // 애니메이션 완료 후 제거
    setTimeout(() => {
      if (this.overlay.parentNode) {
        this.overlay.parentNode.removeChild(this.overlay);
      }
      
      if (this.escapeHandler) {
        document.removeEventListener('keydown', this.escapeHandler);
      }
      
      if (this.onClose) {
        this.onClose();
      }
    }, 300);
    
    this.isOpen = false;
  }

  /**
   * 모달 내용 업데이트
   * @param {string|HTMLElement} content - 새로운 내용
   */
  updateContent(content) {
    const body = this.element.querySelector('.modal-body');
    if (!body) return;
    
    body.innerHTML = '';
    if (typeof content === 'string') {
      body.innerHTML = content;
    } else if (content instanceof HTMLElement) {
      body.appendChild(content);
    }
  }

  /**
   * 인스턴스 메서드: 확인 모달 표시
   * @param {string} title - 제목
   * @param {string|HTMLElement} message - 메시지
   * @param {string} confirmText - 확인 버튼 텍스트 (기본값: '확인')
   * @param {string} cancelText - 취소 버튼 텍스트 (기본값: '취소')
   * @returns {Promise<boolean>} 확인 여부
   */
  confirm(title, message, confirmText = '확인', cancelText = '취소') {
    return new Promise((resolve) => {
      // 모달이 body에 없으면 추가
      if (!this.overlay.parentNode) {
        document.body.appendChild(this.overlay);
      }
      
      // 기존 모달 내용 제거
      const body = this.element.querySelector('.modal-body');
      if (body) {
        body.innerHTML = '';
        if (typeof message === 'string') {
          body.innerHTML = message;
        } else if (message instanceof HTMLElement) {
          body.appendChild(message);
        }
      }
      
      // 제목 업데이트
      const header = this.element.querySelector('.modal-header');
      if (header) {
        let titleEl = header.querySelector('.modal-title');
        if (!titleEl) {
          titleEl = document.createElement('h2');
          titleEl.className = 'modal-title';
          header.insertBefore(titleEl, header.firstChild);
        }
        titleEl.textContent = title;
      }
      
      // 기존 푸터 제거
      const existingFooter = this.element.querySelector('.modal-footer');
      if (existingFooter) {
        existingFooter.remove();
      }
      
      // 새 푸터 생성
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = cancelText;
      cancelBtn.addEventListener('click', () => {
        this.close();
        resolve(false);
      });
      
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.textContent = confirmText;
      confirmBtn.addEventListener('click', () => {
        this.close();
        resolve(true);
      });
      
      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
      this.element.appendChild(footer);
      
      // 모달 열기
      if (!this.isOpen) {
        this.open();
      } else {
        // 이미 열려있으면 show 클래스 추가
        this.overlay.classList.add('show');
      }
    });
  }

  /**
   * 정적 메서드: 확인 모달 표시
   * @param {string} message - 메시지
   * @param {string} title - 제목
   * @returns {Promise<boolean>} 확인 여부
   */
  static confirm(message, title = '확인') {
    return new Promise((resolve) => {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      
      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = '취소';
      cancelBtn.addEventListener('click', () => {
        modal.close();
        resolve(false);
      });
      
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.textContent = '확인';
      confirmBtn.addEventListener('click', () => {
        modal.close();
        resolve(true);
      });
      
      footer.appendChild(cancelBtn);
      footer.appendChild(confirmBtn);
      
      const modal = new Modal({
        title,
        content: message,
        footer,
        closeOnOverlayClick: false,
      });
      
      modal.open();
    });
  }

  /**
   * 정적 메서드: 알림 모달 표시
   * @param {string} message - 메시지
   * @param {string} title - 제목
   * @returns {Promise<void>}
   */
  static alert(message, title = '알림') {
    return new Promise((resolve) => {
      const footer = document.createElement('div');
      footer.className = 'modal-footer';
      
      const okBtn = document.createElement('button');
      okBtn.className = 'btn btn-primary';
      okBtn.textContent = '확인';
      okBtn.addEventListener('click', () => {
        modal.close();
        resolve();
      });
      
      footer.appendChild(okBtn);
      
      const modal = new Modal({
        title,
        content: message,
        footer,
        closeOnOverlayClick: false,
      });
      
      modal.open(() => resolve());
    });
  }
}

export default Modal;


