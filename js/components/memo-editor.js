/**
 * 메모 입력 모듈 컴포넌트
 * 바인더 노트 형식의 메모 작성/수정 UI
 */

// 태그 목록 (하드코딩 - 나중에 API로 가져올 수 있도록 확장 가능)
// 실제 태그는 DB에 저장되어 있으며, 프론트엔드에서 직접 조회하는 별도 API는 없음
// 태그 코드(code)를 사용하여 메모 작성/수정 시 전달
// 백엔드 시드 데이터(V16__Insert_tags_seed_data.sql)와 일치해야 함
const TAG_LIST = {
  TYPE: [
    { code: 'summary', label: '요약' },
    { code: 'quote', label: '인용/문장' },
    { code: 'feeling', label: '느낌/소감' },
    { code: 'question', label: '질문/의문' },
    { code: 'connection', label: '비교/연관' },
    { code: 'critique', label: '분석/비평' },
    { code: 'idea', label: '아이디어/영감' },
    { code: 'action', label: '액션/실천' },
  ],
  TOPIC: [
    { code: 'character', label: '인물/캐릭터' },
    { code: 'plot', label: '스토리/플롯' },
    { code: 'knowledge', label: '지식/정보' },
    { code: 'lesson', label: '교훈/명언' },
    { code: 'emotion', label: '감정/심리' },
    { code: 'society', label: '사회/문화' },
    { code: 'philosophy', label: '철학/사고' },
    { code: 'creation', label: '창작/상상' },
  ],
};

export class MemoEditor {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.memoInput = null;
    this.memoPageInput = null;
    this.tagChips = null;
    this.btnSaveMemo = null;
    this.selectedTags = new Set(); // 선택된 태그 코드 Set
    this.currentTagCategory = 'TYPE'; // 기본값: TYPE
    this.onSave = null; // 저장 콜백
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    if (!this.container) {
      console.error('Memo editor container not found');
      return;
    }

    // DOM 요소 선택
    this.memoInput = this.container.querySelector('#memo-input');
    this.memoPageInput = this.container.querySelector('#memo-page-input');
    this.tagChips = this.container.querySelector('#tag-chips');
    this.btnSaveMemo = this.container.querySelector('#btn-save-memo');

    // 태그 칩 이벤트 위임 (한 번만 등록)
    if (this.tagChips) {
      this.tagChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (chip) {
          const tagCode = chip.dataset.tagCode;
          if (tagCode) {
            this.toggleTag(tagCode);
          }
        }
      });
    }

    // 태그 칩 렌더링
    this.renderTagChips();

    // 저장 버튼 이벤트
    if (this.btnSaveMemo) {
      this.btnSaveMemo.addEventListener('click', () => {
        this.handleSave();
      });
    }
  }

  /**
   * 태그 칩 렌더링
   */
  renderTagChips() {
    if (!this.tagChips) return;

    const tags = TAG_LIST[this.currentTagCategory] || [];
    
    let html = '';
    tags.forEach((tag) => {
      const isSelected = this.selectedTags.has(tag.code);
      html += `
        <button 
          class="tag-chip ${isSelected ? 'selected' : ''}" 
          data-tag-code="${tag.code}"
          type="button"
        >
          ${this.escapeHtml(tag.label)}
        </button>
      `;
    });

    this.tagChips.innerHTML = html;

    // 이벤트 위임은 init()에서 한 번만 등록되므로 여기서는 HTML만 업데이트
  }

  /**
   * 태그 선택/해제
   * @param {string} tagCode - 태그 코드
   */
  toggleTag(tagCode) {
    if (this.selectedTags.has(tagCode)) {
      this.selectedTags.delete(tagCode);
    } else {
      this.selectedTags.add(tagCode);
    }
    
    // UI 업데이트
    const chip = this.tagChips.querySelector(`[data-tag-code="${tagCode}"]`);
    if (chip) {
      chip.classList.toggle('selected');
    }
  }

  /**
   * 태그 대분류 변경
   * @param {string} category - 태그 대분류 (TYPE, TOPIC)
   */
  setTagCategory(category) {
    if (category !== 'TYPE' && category !== 'TOPIC') {
      console.warn('Invalid tag category:', category);
      return;
    }
    
    this.currentTagCategory = category;
    this.selectedTags.clear(); // 태그 대분류 변경 시 선택 초기화
    this.renderTagChips();
  }

  /**
   * 메모 저장 처리
   */
  handleSave() {
    const content = this.memoInput ? this.memoInput.value.trim() : '';
    const pageNumber = this.memoPageInput ? parseInt(this.memoPageInput.value, 10) : null;
    
    if (!pageNumber || isNaN(pageNumber) || pageNumber < 1) {
      alert('페이지 번호를 입력해주세요. (1 이상의 숫자)');
      return;
    }
    
    if (!content) {
      alert('메모 내용을 입력해주세요.');
      return;
    }

    // 콜백 호출
    if (this.onSave) {
      const memoData = {
        pageNumber: pageNumber,
        content: content,
        tags: Array.from(this.selectedTags), // 태그 코드 배열
      };
      this.onSave(memoData);
    }
  }

  /**
   * 입력 필드 초기화
   */
  clear() {
    if (this.memoInput) {
      this.memoInput.value = '';
    }
    if (this.memoPageInput) {
      this.memoPageInput.value = '';
    }
    this.selectedTags.clear();
    this.renderTagChips();
  }

  /**
   * 메모 데이터 설정 (수정 모드)
   * @param {Object} memo - 메모 데이터
   */
  setMemoData(memo) {
    if (!memo) return;

    // 페이지 번호 설정
    if (this.memoPageInput && memo.pageNumber) {
      this.memoPageInput.value = memo.pageNumber;
    }

    // 내용 설정
    if (this.memoInput && memo.content) {
      this.memoInput.value = memo.content;
    }

    // 태그 설정
    this.selectedTags.clear();
    if (memo.tags && Array.isArray(memo.tags)) {
      memo.tags.forEach(tag => {
        // tag가 문자열이면 그대로, 객체면 code 속성 사용
        const tagCode = typeof tag === 'string' ? tag : tag.code;
        if (tagCode) {
          this.selectedTags.add(tagCode);
        }
      });
    }
    
    this.renderTagChips();
  }

  /**
   * 저장 콜백 설정
   * @param {Function} callback - 저장 콜백 함수
   */
  setOnSave(callback) {
    this.onSave = callback;
  }

  /**
   * HTML 이스케이프
   * @param {string} text - 이스케이프할 텍스트
   * @returns {string} 이스케이프된 텍스트
   */
  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export default MemoEditor;

