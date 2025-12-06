/**
 * 메모 카드 컴포넌트
 * 바인더 노트 형식으로 메모를 표시
 */

// 태그 코드를 라벨로 변환하기 위한 태그 목록 (memo-editor.js와 동일)
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

export class MemoCard {
  /**
   * 태그 코드를 라벨로 변환
   * @param {string} tagCode - 태그 코드
   * @returns {string} 태그 라벨 (없으면 코드 반환)
   */
  static getTagLabel(tagCode) {
    if (!tagCode) return tagCode;
    
    // TYPE과 TOPIC 모두에서 찾기
    for (const category of Object.values(TAG_LIST)) {
      const tag = category.find(t => t.code === tagCode);
      if (tag) {
        return tag.label;
      }
    }
    
    // 찾지 못하면 코드 반환
    return tagCode;
  }

  /**
   * 동기화 상태 아이콘 반환
   * @param {string} syncStatus - 동기화 상태
   * @returns {string} 상태 아이콘
   */
  static getSyncStatusIcon(syncStatus) {
    if (!syncStatus) return '';
    
    const statusIcons = {
      'pending': '⏳',           // 대기 중
      'syncing': '🔄',          // 동기화 중
      'syncing_create': '🔄',   // 생성 동기화 중
      'syncing_update': '🔄',   // 수정 동기화 중
      'syncing_delete': '🔄',   // 삭제 동기화 중
      'synced': '✓',            // 동기화 완료
      'failed': '❌',           // 동기화 실패
      'waiting': '⏸️'           // 대기 중 (다른 작업 완료 대기)
    };
    
    return statusIcons[syncStatus] || '';
  }

  /**
   * 동기화 상태 툴팁 텍스트 반환
   * @param {string} syncStatus - 동기화 상태
   * @returns {string} 툴팁 텍스트
   */
  static getSyncStatusTooltip(syncStatus) {
    if (!syncStatus) return '';
    
    const statusTooltips = {
      'pending': '동기화 대기 중',
      'syncing': '동기화 중',
      'syncing_create': '생성 동기화 중',
      'syncing_update': '수정 동기화 중',
      'syncing_delete': '삭제 동기화 중',
      'synced': '동기화 완료',
      'failed': '동기화 실패',
      'waiting': '대기 중'
    };
    
    return statusTooltips[syncStatus] || '';
  }

  /**
   * 메모 카드 HTML 렌더링
   * @param {Object} memo - 메모 데이터
   * @returns {string} HTML 문자열
   */
  static render(memo) {
    const tagsHtml = memo.tags && memo.tags.length > 0
      ? memo.tags.map(tag => {
          const tagLabel = this.getTagLabel(tag);
          return `<span class="memo-tag">${this.escapeHtml(tagLabel)}</span>`;
        }).join('')
      : '';
    
    const memoStartTime = memo.memoStartTime 
      ? new Date(memo.memoStartTime).toLocaleString('ko-KR', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : '';
    
    // 동기화 상태 아이콘 (syncStatus가 있고, synced가 아닐 때만 표시)
    const syncStatusIcon = memo.syncStatus && memo.syncStatus !== 'synced'
      ? `<span class="memo-sync-status" title="${this.getSyncStatusTooltip(memo.syncStatus)}" aria-label="${this.getSyncStatusTooltip(memo.syncStatus)}">${this.getSyncStatusIcon(memo.syncStatus)}</span>`
      : '';
    
    return `
      <div class="memo-card" data-memo-id="${memo.id}" data-local-id="${memo.localId || ''}">
        ${tagsHtml ? `<div class="memo-card-tags">${tagsHtml}</div>` : ''}
        <div class="memo-card-header">
          <div class="memo-card-meta">
            <span class="memo-card-time">${this.escapeHtml(memoStartTime)}</span>
            ${memo.pageNumber ? `<span class="memo-card-page">p.${memo.pageNumber}</span>` : ''}
            ${syncStatusIcon}
          </div>
          <div class="memo-card-actions">
            <button class="btn-icon memo-edit-btn" data-memo-id="${memo.id}" aria-label="수정">
              ✏️
            </button>
            <button class="btn-icon memo-delete-btn" data-memo-id="${memo.id}" aria-label="삭제">
              🗑️
            </button>
          </div>
        </div>
        <div class="memo-card-content">
          ${this.escapeHtml(memo.content || '')}
        </div>
      </div>
    `;
  }

  /**
   * HTML 이스케이프
   * @param {string} text - 이스케이프할 텍스트
   * @returns {string} 이스케이프된 텍스트
   */
  static escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}


