/**
 * 입력 검증 유틸리티
 * 폼 입력값 검증을 위한 함수 제공
 */

/**
 * 이메일 형식 검증
 * @param {string} email - 검증할 이메일 주소
 * @returns {boolean} 유효한 이메일인지 여부
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * 비밀번호 강도 검증
 * 최소 8자, 영문/숫자/특수문자 조합
 * @param {string} password - 검증할 비밀번호
 * @returns {Object} { valid: boolean, message: string }
 */
export function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      message: '비밀번호를 입력해주세요.',
    };
  }
  
  if (password.length < 8) {
    return {
      valid: false,
      message: '비밀번호는 최소 8자 이상이어야 합니다.',
    };
  }
  
  // 영문, 숫자, 특수문자 포함 여부 확인
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  
  if (!hasLetter || !hasNumber || !hasSpecial) {
    return {
      valid: false,
      message: '비밀번호는 영문, 숫자, 특수문자를 모두 포함해야 합니다.',
    };
  }
  
  return {
    valid: true,
    message: '',
  };
}

/**
 * 비밀번호 확인 일치 검증
 * @param {string} password - 원본 비밀번호
 * @param {string} confirmPassword - 확인 비밀번호
 * @returns {boolean} 일치하는지 여부
 */
export function isPasswordMatch(password, confirmPassword) {
  if (!password || !confirmPassword) return false;
  return password === confirmPassword;
}

/**
 * 로그인 ID 형식 검증
 * 영문, 숫자, 언더스코어만 허용, 3-20자
 * @param {string} loginId - 검증할 로그인 ID
 * @returns {Object} { valid: boolean, message: string }
 */
export function validateLoginId(loginId) {
  if (!loginId || typeof loginId !== 'string') {
    return {
      valid: false,
      message: '로그인 ID를 입력해주세요.',
    };
  }
  
  const trimmedId = loginId.trim();
  
  if (trimmedId.length < 3 || trimmedId.length > 20) {
    return {
      valid: false,
      message: '로그인 ID는 3자 이상 20자 이하여야 합니다.',
    };
  }
  
  const idRegex = /^[a-zA-Z0-9_]+$/;
  if (!idRegex.test(trimmedId)) {
    return {
      valid: false,
      message: '로그인 ID는 영문, 숫자, 언더스코어(_)만 사용할 수 있습니다.',
    };
  }
  
  return {
    valid: true,
    message: '',
  };
}

/**
 * 이름 검증
 * 2-20자, 한글/영문만 허용
 * @param {string} name - 검증할 이름
 * @returns {Object} { valid: boolean, message: string }
 */
export function validateName(name) {
  if (!name || typeof name !== 'string') {
    return {
      valid: false,
      message: '이름을 입력해주세요.',
    };
  }
  
  const trimmedName = name.trim();
  
  if (trimmedName.length < 2 || trimmedName.length > 20) {
    return {
      valid: false,
      message: '이름은 2자 이상 20자 이하여야 합니다.',
    };
  }
  
  const nameRegex = /^[가-힣a-zA-Z\s]+$/;
  if (!nameRegex.test(trimmedName)) {
    return {
      valid: false,
      message: '이름은 한글 또는 영문만 사용할 수 있습니다.',
    };
  }
  
  return {
    valid: true,
    message: '',
  };
}

/**
 * 필수 필드 검증
 * @param {string} value - 검증할 값
 * @param {string} fieldName - 필드 이름 (에러 메시지용)
 * @returns {Object} { valid: boolean, message: string }
 */
export function validateRequired(value, fieldName = '필드') {
  if (!value || (typeof value === 'string' && value.trim().length === 0)) {
    return {
      valid: false,
      message: `${fieldName}을(를) 입력해주세요.`,
    };
  }
  
  return {
    valid: true,
    message: '',
  };
}

/**
 * 숫자 범위 검증
 * @param {number} value - 검증할 숫자
 * @param {number} min - 최소값
 * @param {number} max - 최대값
 * @returns {Object} { valid: boolean, message: string }
 */
export function validateNumberRange(value, min, max) {
  const num = Number(value);
  
  if (isNaN(num)) {
    return {
      valid: false,
      message: '숫자를 입력해주세요.',
    };
  }
  
  if (num < min || num > max) {
    return {
      valid: false,
      message: `${min} 이상 ${max} 이하의 숫자를 입력해주세요.`,
    };
  }
  
  return {
    valid: true,
    message: '',
  };
}

/**
 * ISBN 형식 검증 (간단한 버전)
 * @param {string} isbn - 검증할 ISBN
 * @returns {boolean} 유효한 ISBN인지 여부
 */
export function isValidISBN(isbn) {
  if (!isbn || typeof isbn !== 'string') return false;
  
  // ISBN-10 또는 ISBN-13 형식 (숫자와 하이픈만 허용)
  const isbnRegex = /^(?:\d{3}-?\d{1}-?\d{3}-?\d{5}-?\d{1}|\d{10}|\d{13})$/;
  return isbnRegex.test(isbn.replace(/-/g, ''));
}

export default {
  isValidEmail,
  validatePassword,
  isPasswordMatch,
  validateLoginId,
  validateName,
  validateRequired,
  validateNumberRange,
  isValidISBN,
};


