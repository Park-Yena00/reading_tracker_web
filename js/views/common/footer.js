/**
 * 푸터 컴포넌트
 * 공통 푸터 컴포넌트
 */

export class FooterView {
  constructor(containerId = 'footer') {
    this.container = document.getElementById(containerId);
    
    if (!this.container) {
      console.warn(`Footer container with id "${containerId}" not found`);
      return;
    }
    
    this.render();
  }

  /**
   * 푸터 렌더링
   */
  render() {
    const currentYear = new Date().getFullYear();
    
    this.container.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footer-content">
            <p class="footer-copyright">
              &copy; ${currentYear} Reading Tracker. All rights reserved.
            </p>
            <div class="footer-links">
              <a href="#" class="footer-link">이용약관</a>
              <span class="footer-separator">|</span>
              <a href="#" class="footer-link">개인정보처리방침</a>
              <span class="footer-separator">|</span>
              <a href="#" class="footer-link">문의하기</a>
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}

export default FooterView;


