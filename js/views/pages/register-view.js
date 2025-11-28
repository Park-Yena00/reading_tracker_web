/**
 * 회원가입 페이지 뷰
 * 회원가입 폼 처리 및 회원가입 로직 관리
 */

import authHelper from '../../utils/auth-helper.js';
import authService from '../../services/auth-service.js';
import { validateLoginId, validateEmail, validatePassword, isPasswordMatch, validateName } from '../../utils/validators.js';
import { ROUTES } from '../../constants/routes.js';
import LoadingSpinner from '../common/loading.js';
import HeaderView from '../common/header.js';
import FooterView from '../common/footer.js';

class RegisterView {
  constructor() {
    this.form = null;
    this.errorMessageEl = null;
    this.isSubmitting = false;
    
    // 이미 로그인된 경우 서재 페이지로 리다이렉트
    if (authHelper.isAuthenticated()) {
      window.location.href = ROUTES.BOOKSHELF;
      return;
    }
    
    // 중복 확인 상태
    this.verifiedLoginId = false;
    this.verifiedEmail = false;
    
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
    this.form = document.getElementById('register-form');
    this.errorMessageEl = document.getElementById('error-message');
    
    if (!this.form) {
      console.error('Register form not found');
      return;
    }
    
    // 폼 제출 이벤트 리스너
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // 중복 확인 버튼 이벤트
    document.getElementById('check-loginId')?.addEventListener('click', () => {
      this.checkLoginIdDuplicate();
    });
    
    document.getElementById('check-email')?.addEventListener('click', () => {
      this.checkEmailDuplicate();
    });
    
    // 실시간 입력 검증
    document.getElementById('loginId')?.addEventListener('blur', () => {
      this.validateLoginId();
    });
    
    document.getElementById('email')?.addEventListener('blur', () => {
      this.validateEmail();
    });
    
    document.getElementById('name')?.addEventListener('blur', () => {
      this.validateName();
    });
    
    document.getElementById('password')?.addEventListener('blur', () => {
      this.validatePassword();
      this.validateConfirmPassword();
    });
    
    document.getElementById('confirmPassword')?.addEventListener('blur', () => {
      this.validateConfirmPassword();
    });
    
    // 입력 변경 시 중복 확인 상태 초기화
    document.getElementById('loginId')?.addEventListener('input', () => {
      this.verifiedLoginId = false;
      this.hideFieldSuccess('loginId');
    });
    
    document.getElementById('email')?.addEventListener('input', () => {
      this.verifiedEmail = false;
      this.hideFieldSuccess('email');
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
    
    // 중복 확인 체크
    if (!this.verifiedLoginId) {
      this.showError('로그인 ID 중복 확인을 해주세요.');
      return;
    }
    
    if (!this.verifiedEmail) {
      this.showError('이메일 중복 확인을 해주세요.');
      return;
    }
    
    this.isSubmitting = true;
    this.setLoading(true);
    this.hideError();
    
    // 폼 데이터 수집
    const formData = new FormData(this.form);
    const registerData = {
      loginId: formData.get('loginId').trim(),
      email: formData.get('email').trim(),
      name: formData.get('name').trim(),
      password: formData.get('password'),
    };
    
    try {
      // 회원가입 처리
      const result = await authHelper.handleRegister(registerData);
      
      if (result.success) {
        // 회원가입 성공
        this.showSuccess('회원가입이 완료되었습니다! 로그인 페이지로 이동합니다...');
        
        // 로그인 페이지로 리다이렉트
        setTimeout(() => {
          window.location.href = ROUTES.LOGIN;
        }, 1500);
      } else {
        // 회원가입 실패
        this.showError(result.error || '회원가입에 실패했습니다.');
        
        // 필드별 에러 메시지 표시
        if (result.fieldErrors && result.fieldErrors.length > 0) {
          this.showFieldErrors(result.fieldErrors);
        }
      }
    } catch (error) {
      console.error('회원가입 오류:', error);
      this.showError(error.message || '회원가입 중 오류가 발생했습니다.');
    } finally {
      this.isSubmitting = false;
      this.setLoading(false);
    }
  }

  /**
   * 로그인 ID 중복 확인
   */
  async checkLoginIdDuplicate() {
    const loginIdInput = document.getElementById('loginId');
    const loginId = loginIdInput?.value.trim();
    const checkButton = document.getElementById('check-loginId');
    
    // 입력값 검증
    if (!loginId) {
      this.showFieldError('loginId', '로그인 ID를 입력해주세요.');
      return;
    }
    
    const validation = validateLoginId(loginId);
    if (!validation.valid) {
      this.showFieldError('loginId', validation.message);
      return;
    }
    
    // 로딩 상태
    if (checkButton) {
      checkButton.disabled = true;
      checkButton.textContent = '확인 중...';
    }
    
    try {
      const isDuplicate = await authService.checkLoginIdDuplicate(loginId);
      
      if (isDuplicate) {
        this.showFieldError('loginId', '이미 사용 중인 로그인 ID입니다.');
        this.verifiedLoginId = false;
        this.hideFieldSuccess('loginId');
      } else {
        this.hideFieldError('loginId');
        this.showFieldSuccess('loginId');
        this.verifiedLoginId = true;
      }
    } catch (error) {
      console.error('중복 확인 오류:', error);
      this.showFieldError('loginId', '중복 확인 중 오류가 발생했습니다.');
      this.verifiedLoginId = false;
    } finally {
      if (checkButton) {
        checkButton.disabled = false;
        checkButton.textContent = '중복 확인';
      }
    }
  }

  /**
   * 이메일 중복 확인
   */
  async checkEmailDuplicate() {
    const emailInput = document.getElementById('email');
    const email = emailInput?.value.trim();
    const checkButton = document.getElementById('check-email');
    
    // 입력값 검증
    if (!email) {
      this.showFieldError('email', '이메일을 입력해주세요.');
      return;
    }
    
    if (!validateEmail(email)) {
      this.showFieldError('email', '올바른 이메일 형식이 아닙니다.');
      return;
    }
    
    // 로딩 상태
    if (checkButton) {
      checkButton.disabled = true;
      checkButton.textContent = '확인 중...';
    }
    
    try {
      const isDuplicate = await authService.checkEmailDuplicate(email);
      
      if (isDuplicate) {
        this.showFieldError('email', '이미 사용 중인 이메일입니다.');
        this.verifiedEmail = false;
        this.hideFieldSuccess('email');
      } else {
        this.hideFieldError('email');
        this.showFieldSuccess('email');
        this.verifiedEmail = true;
      }
    } catch (error) {
      console.error('중복 확인 오류:', error);
      this.showFieldError('email', '중복 확인 중 오류가 발생했습니다.');
      this.verifiedEmail = false;
    } finally {
      if (checkButton) {
        checkButton.disabled = false;
        checkButton.textContent = '중복 확인';
      }
    }
  }

  /**
   * 폼 전체 검증
   * @returns {boolean} 유효성 여부
   */
  validateForm() {
    let isValid = true;
    
    isValid = this.validateLoginId() && isValid;
    isValid = this.validateEmail() && isValid;
    isValid = this.validateName() && isValid;
    isValid = this.validatePassword() && isValid;
    isValid = this.validateConfirmPassword() && isValid;
    
    return isValid;
  }

  /**
   * 로그인 ID 검증
   * @returns {boolean} 유효성 여부
   */
  validateLoginId() {
    const input = document.getElementById('loginId');
    const value = input?.value.trim();
    
    if (!value) {
      this.showFieldError('loginId', '로그인 ID를 입력해주세요.');
      return false;
    }
    
    const validation = validateLoginId(value);
    if (!validation.valid) {
      this.showFieldError('loginId', validation.message);
      return false;
    }
    
    this.hideFieldError('loginId');
    return true;
  }

  /**
   * 이메일 검증
   * @returns {boolean} 유효성 여부
   */
  validateEmail() {
    const input = document.getElementById('email');
    const value = input?.value.trim();
    
    if (!value) {
      this.showFieldError('email', '이메일을 입력해주세요.');
      return false;
    }
    
    if (!validateEmail(value)) {
      this.showFieldError('email', '올바른 이메일 형식이 아닙니다.');
      return false;
    }
    
    this.hideFieldError('email');
    return true;
  }

  /**
   * 이름 검증
   * @returns {boolean} 유효성 여부
   */
  validateName() {
    const input = document.getElementById('name');
    const value = input?.value.trim();
    
    if (!value) {
      this.showFieldError('name', '이름을 입력해주세요.');
      return false;
    }
    
    const validation = validateName(value);
    if (!validation.valid) {
      this.showFieldError('name', validation.message);
      return false;
    }
    
    this.hideFieldError('name');
    return true;
  }

  /**
   * 비밀번호 검증
   * @returns {boolean} 유효성 여부
   */
  validatePassword() {
    const input = document.getElementById('password');
    const value = input?.value;
    
    if (!value) {
      this.showFieldError('password', '비밀번호를 입력해주세요.');
      return false;
    }
    
    const validation = validatePassword(value);
    if (!validation.valid) {
      this.showFieldError('password', validation.message);
      return false;
    }
    
    this.hideFieldError('password');
    return true;
  }

  /**
   * 비밀번호 확인 검증
   * @returns {boolean} 유효성 여부
   */
  validateConfirmPassword() {
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirmPassword');
    const password = passwordInput?.value;
    const confirmPassword = confirmPasswordInput?.value;
    
    if (!confirmPassword) {
      this.showFieldError('confirmPassword', '비밀번호 확인을 입력해주세요.');
      return false;
    }
    
    if (!isPasswordMatch(password, confirmPassword)) {
      this.showFieldError('confirmPassword', '비밀번호가 일치하지 않습니다.');
      return false;
    }
    
    this.hideFieldError('confirmPassword');
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
   * 특정 필드 성공 메시지 표시
   * @param {string} fieldName - 필드 이름
   */
  showFieldSuccess(fieldName) {
    const successEl = document.getElementById(`${fieldName}-success`);
    if (successEl) {
      successEl.style.display = 'block';
    }
  }

  /**
   * 특정 필드 성공 메시지 숨김
   * @param {string} fieldName - 필드 이름
   */
  hideFieldSuccess(fieldName) {
    const successEl = document.getElementById(`${fieldName}-success`);
    if (successEl) {
      successEl.style.display = 'none';
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
    const submitButton = this.form?.querySelector('button[type="submit"]');
    
    if (submitButton) {
      if (loading) {
        submitButton.disabled = true;
        submitButton.classList.add('btn-loading');
        submitButton.textContent = '가입 중...';
      } else {
        submitButton.disabled = false;
        submitButton.classList.remove('btn-loading');
        submitButton.textContent = '회원가입';
      }
    }
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new RegisterView();
});

export default RegisterView;


