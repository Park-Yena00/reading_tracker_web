/**
 * 로딩 스피너 컴포넌트
 * 재사용 가능한 로딩 인디케이터 컴포넌트
 */

export class LoadingSpinner {
  /**
   * 스피너 생성
   * @param {Object} options - 옵션 객체
   * @param {string} options.size - 크기 ('small', 'medium', 'large')
   * @param {string} options.color - 색상 (기본: primary)
   * @returns {HTMLElement} 스피너 요소
   */
  static create(options = {}) {
    const { size = 'medium', color = 'primary' } = options;
    
    const spinner = document.createElement('div');
    spinner.className = `spinner spinner-${size}`;
    
    if (color !== 'primary') {
      spinner.style.borderTopColor = `var(--color-${color})`;
    }
    
    return spinner;
  }

  /**
   * 인라인 로딩 생성 (스피너 + 메시지)
   * @param {string} message - 로딩 메시지
   * @param {Object} options - 옵션 객체
   * @returns {HTMLElement} 로딩 요소
   */
  static createInline(message = '로딩 중...', options = {}) {
    const container = document.createElement('div');
    container.className = 'loading-inline';
    
    const spinner = this.create(options);
    const messageEl = document.createElement('span');
    messageEl.className = 'loading-inline-message';
    messageEl.textContent = message;
    
    container.appendChild(spinner);
    container.appendChild(messageEl);
    
    return container;
  }

  /**
   * 페이지 로딩 오버레이 생성
   * @param {string} message - 로딩 메시지
   * @returns {HTMLElement} 오버레이 요소
   */
  static createOverlay(message = '로딩 중...') {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.id = 'loading-overlay';
    
    const content = document.createElement('div');
    content.className = 'loading-overlay-content';
    
    const spinner = this.create({ size: 'large' });
    const messageEl = document.createElement('p');
    messageEl.className = 'loading-overlay-message';
    messageEl.textContent = message;
    
    content.appendChild(spinner);
    content.appendChild(messageEl);
    overlay.appendChild(content);
    
    return overlay;
  }

  /**
   * 페이지 로딩 표시
   * @param {string} message - 로딩 메시지
   */
  static showOverlay(message) {
    let overlay = document.getElementById('loading-overlay');
    
    if (!overlay) {
      overlay = this.createOverlay(message);
      document.body.appendChild(overlay);
    } else {
      const messageEl = overlay.querySelector('.loading-overlay-message');
      if (messageEl && message) {
        messageEl.textContent = message;
      }
    }
    
    // 약간의 지연 후 표시 (애니메이션을 위해)
    setTimeout(() => {
      overlay.classList.add('show');
    }, 10);
  }

  /**
   * 페이지 로딩 숨김
   */
  static hideOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
      overlay.classList.remove('show');
      
      // 애니메이션 완료 후 제거
      setTimeout(() => {
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      }, 300);
    }
  }
}

export default LoadingSpinner;


