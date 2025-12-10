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
    { code: 'etc', label: '기타' },
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
    { code: 'etc', label: '기타' },
  ],
};

export class MemoEditor {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.memoInput = null;
    this.memoPageInput = null;
    this.tagChipsType = null;
    this.tagChipsTopic = null;
    this.btnSaveMemo = null;
    this.btnCancelMemo = null;
    this.selectedTags = new Set(); // 선택된 태그 코드 Set
    this.tagCategoryAccordion = null; // Accordion 컨테이너
    this.onSave = null; // 저장 콜백
    this.onCancel = null; // 취소 콜백
    
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
    this.tagChipsType = this.container.querySelector('#tag-chips-type');
    this.tagChipsTopic = this.container.querySelector('#tag-chips-topic');
    this.btnSaveMemo = this.container.querySelector('#btn-save-memo');
    this.btnCancelMemo = this.container.querySelector('#btn-cancel-memo');
    this.tagCategoryAccordion = this.container.querySelector('#memo-tag-category-accordion');

    // Accordion 헤더 클릭 이벤트 위임
    if (this.tagCategoryAccordion) {
      this.tagCategoryAccordion.addEventListener('click', (e) => {
        const header = e.target.closest('.accordion-header');
        if (header) {
          e.preventDefault();
          const category = header.dataset.category;
          this.toggleAccordionSection(category);
        }
      });
    }

    // 태그 칩 이벤트 위임 (TYPE과 TOPIC 모두)
    if (this.tagChipsType) {
      this.tagChipsType.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (chip) {
          const tagCode = chip.dataset.tagCode;
          if (tagCode) {
            this.toggleTag(tagCode);
          }
        }
      });
    }

    if (this.tagChipsTopic) {
      this.tagChipsTopic.addEventListener('click', (e) => {
        const chip = e.target.closest('.tag-chip');
        if (chip) {
          const tagCode = chip.dataset.tagCode;
          if (tagCode) {
            this.toggleTag(tagCode);
          }
        }
      });
    }

    // 태그 칩 렌더링 (두 섹션 모두)
    this.renderTagChips();

    // Accordion 초기 상태: TYPE 섹션 펼치기
    if (this.tagCategoryAccordion) {
      const typeContent = this.tagCategoryAccordion.querySelector('.accordion-content[data-category="TYPE"]');
      const typeIcon = this.tagCategoryAccordion.querySelector('.accordion-header[data-category="TYPE"] .accordion-icon');
      if (typeContent) {
        typeContent.classList.add('expanded');
      }
      if (typeIcon) {
        typeIcon.textContent = '▲';
      }
    }

    // 저장 버튼 이벤트
    if (this.btnSaveMemo) {
      this.btnSaveMemo.addEventListener('click', () => {
        this.handleSave();
      });
    }
    
    // 취소 버튼 이벤트
    if (this.btnCancelMemo) {
      this.btnCancelMemo.addEventListener('click', () => {
        this.handleCancel();
      });
    }
  }

  /**
   * 태그 칩 렌더링 (TYPE과 TOPIC 두 섹션 모두)
   */
  renderTagChips() {
    // TYPE 태그 렌더링
    if (this.tagChipsType) {
      const typeTags = TAG_LIST.TYPE || [];
      let typeHtml = '';
      typeTags.forEach((tag) => {
        const isSelected = this.selectedTags.has(tag.code);
        typeHtml += `
          <button 
            class="tag-chip ${isSelected ? 'selected' : ''}" 
            data-tag-code="${tag.code}"
            type="button"
          >
            ${this.escapeHtml(tag.label)}
          </button>
        `;
      });
      this.tagChipsType.innerHTML = typeHtml;
    }

    // TOPIC 태그 렌더링
    if (this.tagChipsTopic) {
      const topicTags = TAG_LIST.TOPIC || [];
      let topicHtml = '';
      topicTags.forEach((tag) => {
        const isSelected = this.selectedTags.has(tag.code);
        topicHtml += `
          <button 
            class="tag-chip ${isSelected ? 'selected' : ''}" 
            data-tag-code="${tag.code}"
            type="button"
          >
            ${this.escapeHtml(tag.label)}
          </button>
        `;
      });
      this.tagChipsTopic.innerHTML = topicHtml;
    }
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
    
    // UI 업데이트 (TYPE과 TOPIC 모두에서 찾기)
    const chipType = this.tagChipsType?.querySelector(`[data-tag-code="${tagCode}"]`);
    const chipTopic = this.tagChipsTopic?.querySelector(`[data-tag-code="${tagCode}"]`);
    
    if (chipType) {
      chipType.classList.toggle('selected');
    }
    if (chipTopic) {
      chipTopic.classList.toggle('selected');
    }
  }

  /**
   * 선택된 태그의 대분류 결정
   * @returns {string} 태그 대분류 (TYPE 또는 TOPIC, 기본값: TYPE)
   */
  getTagCategoryFromSelectedTags() {
    if (this.selectedTags.size === 0) {
      return 'TYPE'; // 기본값
    }

    // 선택된 태그 중 하나의 대분류 확인
    for (const tagCode of this.selectedTags) {
      // TYPE 태그 목록에서 찾기
      if (TAG_LIST.TYPE.some(tag => tag.code === tagCode)) {
        return 'TYPE';
      }
      // TOPIC 태그 목록에서 찾기
      if (TAG_LIST.TOPIC.some(tag => tag.code === tagCode)) {
        return 'TOPIC';
      }
    }

    return 'TYPE'; // 기본값
  }

  /**
   * Accordion 섹션 토글
   * @param {string} category - 태그 대분류 (TYPE, TOPIC)
   */
  toggleAccordionSection(category) {
    if (!this.tagCategoryAccordion) return;

    const header = this.tagCategoryAccordion.querySelector(`.accordion-header[data-category="${category}"]`);
    const content = this.tagCategoryAccordion.querySelector(`.accordion-content[data-category="${category}"]`);
    const icon = header?.querySelector('.accordion-icon');

    if (!header || !content) return;

    const isExpanded = content.classList.contains('expanded');

    // 모든 섹션 접기
    this.tagCategoryAccordion.querySelectorAll('.accordion-content').forEach((section) => {
      section.classList.remove('expanded');
    });
    this.tagCategoryAccordion.querySelectorAll('.accordion-icon').forEach((ic) => {
      ic.textContent = '▼';
    });

    // 클릭한 섹션만 토글
    if (!isExpanded) {
      content.classList.add('expanded');
      if (icon) {
        icon.textContent = '▲';
      }
    }
  }

  /**
   * 태그 대분류 변경 (외부에서 호출 가능, 하지만 Accordion에서는 사용하지 않음)
   * @param {string} category - 태그 대분류 (TYPE, TOPIC)
   */
  setTagCategory(category) {
    // Accordion 방식에서는 이 메서드를 사용하지 않지만,
    // 호환성을 위해 유지 (태그 선택은 초기화하지 않음)
    if (category !== 'TYPE' && category !== 'TOPIC') {
      console.warn('Invalid tag category:', category);
      return;
    }
    
    // Accordion에서 해당 섹션 펼치기
    this.toggleAccordionSection(category);
  }

  /**
   * 메모 저장 처리
   */
  handleSave() {
    const content = this.memoInput ? this.memoInput.value.trim() : '';
    const pageNumber = this.memoPageInput ? parseInt(this.memoPageInput.value, 10) : null;
    
    // 페이지 번호 검증 (수정 모드에서도 페이지 번호 수정 가능하므로 항상 검증)
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
      // 선택된 태그의 대분류 결정 (태그가 없으면 TYPE 기본값)
      const tagCategory = this.getTagCategoryFromSelectedTags();
      
      const memoData = {
        pageNumber: pageNumber,
        content: content,
        tags: Array.from(this.selectedTags), // 태그 코드 배열
        tagCategory: tagCategory, // 선택된 태그의 대분류
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
      // 페이지 번호 입력 필드 활성화 (수정 모드 해제)
      this.memoPageInput.disabled = false;
      this.memoPageInput.title = '';
    }
    this.selectedTags.clear();
    this.renderTagChips();
    
    // 저장 버튼 텍스트 원래대로 변경
    if (this.btnSaveMemo) {
      this.btnSaveMemo.textContent = '저장';
    }
    
    // Accordion 섹션 모두 접기
    if (this.tagCategoryAccordion) {
      this.tagCategoryAccordion.querySelectorAll('.accordion-content').forEach((section) => {
        section.classList.remove('expanded');
      });
      this.tagCategoryAccordion.querySelectorAll('.accordion-icon').forEach((icon) => {
        icon.textContent = '▼';
      });
    }
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
    
    // 선택된 태그가 있으면 해당 대분류의 Accordion 섹션 펼치기
    if (this.selectedTags.size > 0) {
      const tagCategory = this.getTagCategoryFromSelectedTags();
      this.toggleAccordionSection(tagCategory);
    }
  }

  /**
   * 저장 콜백 설정
   * @param {Function} callback - 저장 콜백 함수
   */
  setOnSave(callback) {
    this.onSave = callback;
  }
  
  /**
   * 취소 콜백 설정
   * @param {Function} callback - 취소 콜백 함수
   */
  setOnCancel(callback) {
    this.onCancel = callback;
  }
  
  /**
   * 메모 작성 취소 처리
   */
  handleCancel() {
    // 입력 필드 초기화
    this.clear();
    
    // 취소 콜백 호출
    if (this.onCancel) {
      this.onCancel();
    }
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


