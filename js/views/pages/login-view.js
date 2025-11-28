/**
 * 로그인 페이지 뷰
 * 로그인 폼 처리 및 로그인 로직 관리
 */

import authHelper from '../../utils/auth-helper.js';
import { ROUTES } from '../../constants/routes.js';
import LoadingSpinner from '../common/loading.js';
import HeaderView from '../common/header.js';
import FooterView from '../common/footer.js';

class LoginView {
  constructor() {
    this.form = null;
    this.errorMessageEl = null;
    this.loginIdInput = null;
    this.passwordInput = null;
    this.submitButton = null;
    this.isSubmitting = false;
    
    // 이미 로그인된 경우 서재 페이지로 리다이렉트
    if (authHelper.isAuthenticated()) {
      window.location.href = ROUTES.BOOKSHELF;
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
    this.form = document.getElementById('login-form');
    this.errorMessageEl = document.getElementById('error-message');
    this.loginIdInput = document.getElementById('loginId');
    this.passwordInput = document.getElementById('password');
    this.submitButton = this.form?.querySelector('button[type="submit"]');
    
    if (!this.form) {
      console.error('Login form not found');
      return;
    }
    
    // 폼 제출 이벤트 리스너
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // 실시간 입력 검증 (선택사항)
    this.loginIdInput?.addEventListener('blur', () => {
      this.validateLoginId();
    });
    
    this.passwordInput?.addEventListener('blur', () => {
      this.validatePassword();
    });
  }

  /**
   * 폼 제출 처리
   */
  async handleSubmit() {
    if (this.isSubmitting) return;
    
    // 전체 폼 검증
    if (!this.validateForm()) {
      return;
    }
    
    this.isSubmitting = true;
    this.setLoading(true);
    this.hideError();
    
    // 폼 데이터 수집
    const formData = new FormData(this.form);
    const loginData = {
      loginId: formData.get('loginId').trim(),
      password: formData.get('password'),
    };
    
    try {
      // 로그인 처리
      const result = await authHelper.handleLogin(loginData);
      
      if (result.success) {
        // 로그인 성공
        this.showSuccess('로그인 성공! 서재 페이지로 이동합니다...');
        
        // 서재 페이지로 리다이렉트
        setTimeout(() => {
          window.location.href = ROUTES.BOOKSHELF;
        }, 500);
      } else {
        // 로그인 실패
        this.showError(result.error || '로그인에 실패했습니다.');
        
        // 필드별 에러 메시지 표시
        if (result.fieldErrors && result.fieldErrors.length > 0) {
          this.showFieldErrors(result.fieldErrors);
        }
      }
    } catch (error) {
      console.error('로그인 오류:', error);
      this.showError(error.message || '로그인 중 오류가 발생했습니다.');
    } finally {
      this.isSubmitting = false;
      this.setLoading(false);
    }
  }

  /**
   * 폼 전체 검증
   * @returns {boolean} 유효성 여부
   */
  validateForm() {
    let isValid = true;
    
    isValid = this.validateLoginId() && isValid;
    isValid = this.validatePassword() && isValid;
    
    return isValid;
  }

  /**
   * 로그인 ID 검증
   * @returns {boolean} 유효성 여부
   */
  validateLoginId() {
    const value = this.loginIdInput?.value.trim();
    const errorEl = document.getElementById('loginId-error');
    
    if (!value) {
      this.showFieldError('loginId', '로그인 ID를 입력해주세요.');
      return false;
    }
    
    this.hideFieldError('loginId');
    return true;
  }

  /**
   * 비밀번호 검증
   * @returns {boolean} 유효성 여부
   */
  validatePassword() {
    const value = this.passwordInput?.value;
    const errorEl = document.getElementById('password-error');
    
    if (!value) {
      this.showFieldError('password', '비밀번호를 입력해주세요.');
      return false;
    }
    
    this.hideFieldError('password');
    return true;
  }

  /**
   * 필드별 에러 메시지 표시
   * @param {Array} fieldErrors - 필드 에러 배열
   */
  showFieldErrors(fieldErrors) {
    fieldErrors.forEach((fieldError) => {
      this.showFieldError(fieldError.field, fieldError.message);
    });
  }

  /**
   * 특정 필드 에러 메시지 표시
   * @param {string} fieldName - 필드 이름
   * @param {string} message - 에러 메시지
   */
  showFieldError(fieldName, message) {
    const input = document.getElementById(fieldName);
    const errorEl = document.getElementById(`${fieldName}-error`);
    
    if (input) {
      input.classList.add('error');
    }
    
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  /**
   * 특정 필드 에러 메시지 숨김
   * @param {string} fieldName - 필드 이름
   */
  hideFieldError(fieldName) {
    const input = document.getElementById(fieldName);
    const errorEl = document.getElementById(`${fieldName}-error`);
    
    if (input) {
      input.classList.remove('error');
    }
    
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.style.display = 'none';
    }
  }

  /**
   * 전체 에러 메시지 표시
   * @param {string} message - 에러 메시지
   */
  showError(message) {
    if (this.errorMessageEl) {
      this.errorMessageEl.textContent = message;
      this.errorMessageEl.style.display = 'block';
      this.errorMessageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * 성공 메시지 표시
   * @param {string} message - 성공 메시지
   */
  showSuccess(message) {
    if (this.errorMessageEl) {
      this.errorMessageEl.textContent = message;
      this.errorMessageEl.style.backgroundColor = 'rgba(16, 185, 129, 0.1)';
      this.errorMessageEl.style.color = 'var(--color-success)';
      this.errorMessageEl.style.borderColor = 'var(--color-success)';
      this.errorMessageEl.style.display = 'block';
    }
  }

  /**
   * 에러 메시지 숨김
   */
  hideError() {
    if (this.errorMessageEl) {
      this.errorMessageEl.style.display = 'none';
      this.errorMessageEl.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
      this.errorMessageEl.style.color = 'var(--color-danger)';
      this.errorMessageEl.style.borderColor = 'var(--color-danger)';
    }
  }

  /**
   * 로딩 상태 설정
   * @param {boolean} loading - 로딩 여부
   */
  setLoading(loading) {
    if (this.submitButton) {
      if (loading) {
        this.submitButton.disabled = true;
        this.submitButton.classList.add('btn-loading');
        this.submitButton.textContent = '로그인 중...';
      } else {
        this.submitButton.disabled = false;
        this.submitButton.classList.remove('btn-loading');
        this.submitButton.textContent = '로그인';
      }
    }
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new LoginView();
});

export default LoginView;


