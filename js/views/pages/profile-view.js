/**
 * 프로필 페이지 뷰
 * 프로필 정보 조회 및 수정 로직
 */

import userService from '../../services/user-service.js';
import authHelper from '../../utils/auth-helper.js';
import authState from '../../state/auth-state.js';
import { isValidEmail } from '../../utils/validators.js';
import { ROUTES } from '../../constants/routes.js';
import HeaderView from '../common/header.js';
import FooterView from '../common/footer.js';

class ProfileView {
  constructor() {
    this.form = null;
    this.loadingSpinner = null;
    this.profileSection = null;
    this.errorSection = null;
    this.originalProfileData = null;
    this.isSubmitting = false;
    
    // 보호된 페이지: 인증 확인
    if (!authHelper.checkAuth()) {
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
    this.form = document.getElementById('profile-form');
    this.loadingSpinner = document.getElementById('loading-spinner');
    this.profileSection = document.getElementById('profile-section');
    this.errorSection = document.getElementById('error-section');
    
    if (!this.form) {
      console.error('Profile form not found');
      return;
    }
    
    // 폼 제출 이벤트 리스너
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSubmit();
    });
    
    // 취소 버튼 이벤트 리스너
    const btnCancel = document.getElementById('btn-cancel');
    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.resetForm();
      });
    }
    
    // 로그아웃 버튼 이벤트 리스너
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
      btnLogout.addEventListener('click', () => {
        this.handleLogout();
      });
    }
    
    // 뒤로가기 버튼 이벤트 리스너 (즉시 등록)
    this.setupBackButton();
    
    // 실시간 입력 검증
    document.getElementById('email')?.addEventListener('blur', () => {
      this.validateEmail();
    });
    
    // 프로필 정보 로드
    this.loadProfile();
  }

  /**
   * 프로필 정보 로드
   */
  async loadProfile() {
    this.setLoading(true);
    this.hideError();
    
    try {
      const profile = await userService.getProfile();
      this.originalProfileData = profile;
      this.displayProfile(profile);
      this.fillForm(profile);
      
      // 인증 상태 업데이트 (사용자 정보가 있을 경우)
      if (profile) {
        authState.setUser(profile);
      }
    } catch (error) {
      console.error('프로필 로드 오류:', error);
      this.showError(error.message || '프로필 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * 프로필 정보 표시
   * @param {Object} profile - 프로필 정보 객체
   */
  displayProfile(profile) {
    // 이름
    const nameEl = document.getElementById('profile-name');
    if (nameEl) {
      nameEl.textContent = profile.name || '이름 없음';
    }
    
    // 이메일
    const emailEl = document.getElementById('profile-email');
    if (emailEl) {
      emailEl.textContent = profile.email || '이메일 없음';
    }
    
    // 로그인 ID
    const loginIdEl = document.getElementById('profile-login-id');
    if (loginIdEl) {
      loginIdEl.textContent = `ID: ${profile.loginId || '알 수 없음'}`;
    }
    
    // 아바타 텍스트 (이름의 첫 글자)
    const avatarTextEl = document.getElementById('avatar-text');
    if (avatarTextEl && profile.name) {
      avatarTextEl.textContent = profile.name.charAt(0).toUpperCase();
    }
    
    // 프로필 섹션 표시
    if (this.profileSection) {
      this.profileSection.style.display = 'block';
    }
  }

  /**
   * 폼에 프로필 정보 채우기
   * @param {Object} profile - 프로필 정보 객체
   */
  fillForm(profile) {
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    
    if (nameInput) {
      nameInput.value = profile.name || '';
    }
    
    if (emailInput) {
      emailInput.value = profile.email || '';
    }
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
    this.hideError();
    this.hideSuccess();
    this.setFormLoading(true);
    
    // 폼 데이터 수집
    const formData = new FormData(this.form);
    const profileData = {
      name: formData.get('name').trim(),
      email: formData.get('email').trim(),
    };
    
    // 변경사항이 없는지 확인
    if (this.originalProfileData) {
      if (
        profileData.name === (this.originalProfileData.name || '') &&
        profileData.email === (this.originalProfileData.email || '')
      ) {
        this.showError('변경된 내용이 없습니다.');
        this.isSubmitting = false;
        this.setFormLoading(false);
        return;
      }
    }
    
    try {
      // 프로필 수정
      const updatedProfile = await userService.updateProfile(profileData);
      
      // 성공 메시지
      this.showSuccess('프로필이 성공적으로 수정되었습니다.');
      
      // 프로필 정보 업데이트
      this.originalProfileData = updatedProfile;
      this.displayProfile(updatedProfile);
      
      // 인증 상태 업데이트
      authState.setUser(updatedProfile);
      
      // 폼 다시 채우기
      this.fillForm(updatedProfile);
      
    } catch (error) {
      console.error('프로필 수정 오류:', error);
      
      // 필드별 에러 메시지 표시
      if (error.fieldErrors && error.fieldErrors.length > 0) {
        this.showFieldErrors(error.fieldErrors);
      } else {
        this.showError(error.message || '프로필 수정 중 오류가 발생했습니다.');
      }
    } finally {
      this.isSubmitting = false;
      this.setFormLoading(false);
    }
  }

  /**
   * 폼 전체 검증
   * @returns {boolean} 유효성 여부
   */
  validateForm() {
    let isValid = true;
    
    isValid = this.validateName() && isValid;
    
    // 이메일은 선택사항이지만, 입력한 경우 검증
    const emailInput = document.getElementById('email');
    if (emailInput && emailInput.value.trim()) {
      isValid = this.validateEmail() && isValid;
    }
    
    return isValid;
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
    
    this.hideFieldError('name');
    return true;
  }

  /**
   * 이메일 검증
   * @returns {boolean} 유효성 여부
   */
  validateEmail() {
    const input = document.getElementById('email');
    const value = input?.value.trim();
    
    // 이메일은 선택사항이므로 비어있으면 통과
    if (!value) {
      this.hideFieldError('email');
      return true;
    }
    
    if (!isValidEmail(value)) {
      this.showFieldError('email', '올바른 이메일 형식이 아닙니다.');
      return false;
    }
    
    this.hideFieldError('email');
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
   * 폼 초기화
   */
  resetForm() {
    if (this.originalProfileData) {
      this.fillForm(this.originalProfileData);
      this.hideError();
      this.hideSuccess();
      // 모든 필드 에러 숨김
      ['name', 'email'].forEach(fieldName => {
        this.hideFieldError(fieldName);
      });
    }
  }

  /**
   * 로그아웃 처리
   */
  handleLogout() {
    if (confirm('로그아웃하시겠습니까?')) {
      authHelper.handleLogout();
    }
  }

  /**
   * 뒤로가기 버튼 설정 (즉시 등록)
   */
  setupBackButton() {
    const btnBack = document.getElementById('btn-back');
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        this.handleBack();
      });
    } else {
      // DOM이 아직 준비되지 않았으면 재시도
      setTimeout(() => this.setupBackButton(), 50);
    }
  }

  /**
   * 뒤로가기 처리
   */
  handleBack() {
    // 홈 화면으로 이동
    window.location.href = '/';
  }

  /**
   * 전체 에러 메시지 표시
   * @param {string} message - 에러 메시지
   */
  showError(message) {
    const errorMessageEl = document.getElementById('error-message');
    if (errorMessageEl) {
      errorMessageEl.textContent = message;
      errorMessageEl.style.display = 'block';
      errorMessageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // 에러 섹션도 표시 (프로필 로드 실패 시)
    if (this.errorSection) {
      const errorTextEl = document.getElementById('error-text');
      if (errorTextEl) {
        errorTextEl.textContent = message;
      }
      this.errorSection.style.display = 'block';
    }
    
    if (this.profileSection) {
      this.profileSection.style.display = 'none';
    }
  }

  /**
   * 성공 메시지 표시
   * @param {string} message - 성공 메시지
   */
  showSuccess(message) {
    const successMessageEl = document.getElementById('success-message');
    if (successMessageEl) {
      successMessageEl.textContent = message;
      successMessageEl.style.display = 'block';
      successMessageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 3초 후 자동으로 숨김
      setTimeout(() => {
        this.hideSuccess();
      }, 3000);
    }
  }

  /**
   * 에러 메시지 숨김
   */
  hideError() {
    const errorMessageEl = document.getElementById('error-message');
    if (errorMessageEl) {
      errorMessageEl.style.display = 'none';
    }
    if (this.errorSection) {
      this.errorSection.style.display = 'none';
    }
  }

  /**
   * 성공 메시지 숨김
   */
  hideSuccess() {
    const successMessageEl = document.getElementById('success-message');
    if (successMessageEl) {
      successMessageEl.style.display = 'none';
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
    if (this.profileSection) {
      this.profileSection.style.display = loading ? 'none' : 'block';
    }
  }

  /**
   * 폼 로딩 상태 설정
   * @param {boolean} loading - 로딩 여부
   */
  setFormLoading(loading) {
    const submitButton = this.form?.querySelector('button[type="submit"]');
    const cancelButton = document.getElementById('btn-cancel');
    
    if (submitButton) {
      submitButton.disabled = loading;
      submitButton.textContent = loading ? '저장 중...' : '저장';
    }
    
    if (cancelButton) {
      cancelButton.disabled = loading;
    }
  }
}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
  new ProfileView();
});

export default ProfileView;


