/**
 * 메모 카드 컴포넌트
 * 바인더 노트 형식으로 메모를 표시
 */

export class MemoCard {
  /**
   * 메모 카드 HTML 렌더링
   * @param {Object} memo - 메모 데이터
   * @returns {string} HTML 문자열
   */
  static render(memo) {
    const tagsHtml = memo.tags && memo.tags.length > 0
      ? memo.tags.map(tag => `<span class="memo-tag">${this.escapeHtml(tag)}</span>`).join('')
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
    
    return `
      <div class="memo-card" data-memo-id="${memo.id}">
        <div class="memo-card-header">
          <div class="memo-card-meta">
            <span class="memo-card-time">${this.escapeHtml(memoStartTime)}</span>
            ${memo.pageNumber ? `<span class="memo-card-page">p.${memo.pageNumber}</span>` : ''}
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
        ${tagsHtml ? `<div class="memo-card-tags">${tagsHtml}</div>` : ''}
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

export default MemoCard;

