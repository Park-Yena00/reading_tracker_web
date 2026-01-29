import { memoService } from '../../services/memo-service.js';
import { bookService } from '../../services/book-service.js';
import { StatisticsHelper } from '../../utils/statistics-helper.js';
import { getTodayDateString } from '../../utils/date-formatter.js';

export class HomeView {
  constructor() {
    this.currentTab = 'daily';
    this.statsDisplay = document.getElementById('stats-display');
    this.loadingSpinner = document.getElementById('stats-loading');
    this.tabButtons = document.querySelectorAll('.stats-tab-btn');
    
    // 인덱스 팔레트와 동일한 색상 적용 (핑크 -> 갈색 -> 연두 순)
    this.palette = ['#b38b7a', '#c7a99b', '#d9a9bf', '#c9b0ba', '#9cbc8f', '#a8c6a0'];
    
    this.init();
  }

  init() {
    if (!this.statsDisplay) return;
    
    this.attachEvents();
    this.loadStats(this.currentTab);
  }

  attachEvents() {
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab;
        if (this.currentTab === tab) return;
        
        this.currentTab = tab;
        this.updateTabUI();
        this.loadStats(tab);
      });
    });
  }

  updateTabUI() {
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === this.currentTab);
    });
  }

  async loadStats(tab) {
    this.setLoading(true);
    this.statsDisplay.innerHTML = '';
    
    try {
      if (tab === 'daily') {
        const today = getTodayDateString();
        // SORT_BY BOOK으로 조회하여 도서별 그룹화 데이터 획득
        const response = await memoService.getTodayFlow({ date: today, sortBy: 'BOOK' });
        const timeTracks = StatisticsHelper.calculateDailyTimeTrack(response.memosByBook || {});
        this.renderDailyStats(timeTracks);
      } else if (tab === 'monthly') {
        // 전체 도서와 활동 이력 도서(최근 10년치로 넉넉히) 동시 조회
        const [shelfResponse, recentActivity] = await Promise.all([
          bookService.getBookshelf(),
          memoService.getRecentMemoBooks(120) 
        ]);
        const neglectedBooks = StatisticsHelper.getNeglectedBooks(shelfResponse.books || [], recentActivity);
        this.renderMonthlyStats(neglectedBooks);
      } else if (tab === 'yearly') {
        const shelfResponse = await bookService.getBookshelf();
        const stats = StatisticsHelper.calculateYearlyStats(shelfResponse.books || []);
        this.renderYearlyStats(stats);
      }
    } catch (error) {
      console.error('[HomeView] 통계 로드 실패:', error);
      this.statsDisplay.innerHTML = '<div class="empty-stats">통계 데이터를 불러오는 중 오류가 발생했습니다.</div>';
    } finally {
      this.setLoading(false);
    }
  }

  setLoading(isLoading) {
    if (this.loadingSpinner) {
      this.loadingSpinner.style.display = isLoading ? 'flex' : 'none';
    }
  }

  /**
   * 일별 통계 렌더링 (24시간 타임 트래커)
   */
  renderDailyStats(timeTracks) {
    if (timeTracks.length === 0) {
      this.statsDisplay.innerHTML = '<div class="empty-stats">오늘 작성된 메모가 없어 통계를 표시할 수 없습니다.</div>';
      return;
    }

    const html = `
      <div class="daily-stats-layout">
        <div class="stats-left-panel">
          <h3 class="stats-sub-title">What stories filled my days?</h3>
          <div class="time-tracker-container">
            <div class="time-tracker-grid">
              ${Array.from({ length: 24 }).map((_, i) => `<div class="hour-cell" title="${i}시"><span>${i}h</span></div>`).join('')}
              <div class="time-track-bars-overlay">
                ${timeTracks.map((track, idx) => {
                  const color = this.palette[idx % this.palette.length];
                  const startMins = track.startTime.getHours() * 60 + track.startTime.getMinutes();
                  const endMins = track.endTime.getHours() * 60 + track.endTime.getMinutes();
                  const left = (startMins / (24 * 60)) * 100;
                  const width = ((endMins - startMins) / (24 * 60)) * 100;
                  return `<div class="time-track-bar" style="left: ${left}%; width: ${Math.max(width, 0.8)}%; background-color: ${color};" title="${this.escapeHtml(track.bookTitle)}"></div>`;
                }).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="stats-right-panel">
          <h3 class="stats-sub-title">도서 정보</h3>
          <ul class="stats-legend-list">
            ${timeTracks.map((track, idx) => {
              const color = this.palette[idx % this.palette.length];
              return `
                <li class="legend-item">
                  <span class="legend-dot" style="background-color: ${color}"></span>
                  <div class="legend-content">
                    <div class="legend-title">${this.escapeHtml(track.bookTitle)}</div>
                    <div class="legend-author">${this.escapeHtml(track.author)}</div>
                  </div>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      </div>
    `;
    this.statsDisplay.innerHTML = html;
  }

  /**
   * 월별 통계 렌더링 (방치한 책 BEST 3)
   */
  renderMonthlyStats(neglectedBooks) {
    if (neglectedBooks.length === 0) {
      this.statsDisplay.innerHTML = '<div class="empty-stats">방치된 도서 정보가 없습니다.</div>';
      return;
    }

    const html = `
      <div class="monthly-stats-layout">
        <h3 class="stats-sub-title center">Time to pick these up again - Longest unread books TOP3</h3>
        <div class="neglected-list">
          ${neglectedBooks.map((book, idx) => `
            <div class="neglected-card">
              <div class="neglected-rank">#${idx + 1}</div>
              <div class="neglected-info">
                <div class="neglected-title">${this.escapeHtml(book.title)}</div>
                <div class="neglected-author">${this.escapeHtml(book.author)}</div>
                <div class="neglected-date">
                  ${book.hasMemo ? '마지막 활동일: ' : '서재 등록일: '}
                  <span>${new Date(book.lastActivityTime).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
    this.statsDisplay.innerHTML = html;
  }

  /**
   * 연별 통계 렌더링 (카테고리별 집계 및 장르 분포 버블 차트)
   */
  renderYearlyStats({ categoryCounts, genreStats }) {
    const categories = [
      { id: 'ToRead', label: '읽을 예정', count: categoryCounts.ToRead, color: '#b38b7a' },
      { id: 'Reading', label: '읽는 중', count: categoryCounts.Reading, color: '#c7a99b' },
      { id: 'AlmostFinished', label: '거의 다 읽음', count: categoryCounts.AlmostFinished, color: '#d9a9bf' },
      { id: 'Finished', label: '완독', count: categoryCounts.Finished, color: '#9cbc8f' }
    ];

    const total = categories.reduce((sum, cat) => sum + cat.count, 0);
    const safeGenreStats = Array.isArray(genreStats) ? genreStats : [];
    const counts = safeGenreStats.map(g => g.count).filter(n => typeof n === 'number' && n > 0);
    const maxCount = counts.length > 0 ? Math.max(...counts) : 1;
    const minCount = counts.length > 0 ? Math.min(...counts) : 1;

    const html = `
      <div class="yearly-stats-layout vertical">
        <div class="stats-top-section">
          <h3 class="stats-sub-title">Library distribution</h3>
          <div class="category-stack-container">
            <div class="category-stack-bar">
              ${total === 0 ? '<div class="stack-segment empty" style="width: 100%; background-color: #f0f0f0"></div>' : 
                categories.map(cat => {
                  const percent = (cat.count / total) * 100;
                  return percent > 0 ? `<div class="stack-segment" style="width: ${percent}%; background-color: ${cat.color}" title="${cat.label}: ${cat.count}권"></div>` : '';
                }).join('')
              }
            </div>
            <div class="category-stack-legend">
              ${categories.map(cat => `
                <div class="stack-legend-item">
                  <div class="legend-info">
                    <span class="legend-dot" style="background-color: ${cat.color}"></span>
                    <span class="legend-label">${cat.label}</span>
                  </div>
                  <span class="legend-value">${cat.count}권</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        
        <div class="stats-bottom-section">
          <h3 class="stats-sub-title">Which genre did I dive into?</h3>
          <div class="genre-bubble-dashboard">
            <div class="bubble-chart-canvas">
              <!-- X/Y축 라벨 -->
              <div class="axis x-axis">완독률 (%)</div>
              <div class="axis y-axis">평균 평점</div>
              
              ${safeGenreStats.length === 0 ? '<p class="empty-text">장르 정보가 없습니다.</p>' : 
                safeGenreStats.map((genre, idx) => {
                  // 크기 계산: 권수 기반 (sqrt 스케일) + 최소/최대 지름 제한
                  const minDiameter = 80;
                  const maxDiameter = 160;
                  const sqrtMin = Math.sqrt(Math.max(minCount, 1));
                  const sqrtMax = Math.sqrt(Math.max(maxCount, 1));
                  const t = (sqrtMax === sqrtMin) ? 1 : (Math.sqrt(Math.max(genre.count, 1)) - sqrtMin) / (sqrtMax - sqrtMin);
                  const diameter = safeGenreStats.length === 1 ? maxDiameter : (minDiameter + (t * (maxDiameter - minDiameter)));
                  const radius = diameter / 2;

                  const color = this.palette[idx % this.palette.length];
                  
                  // 목표 좌표 (X: 완독률 0~100, Y: 평점 0~5 -> canvas top 기준 0~100)
                  const x = Math.max(0, Math.min(100, Number(genre.completionRate) || 0));
                  const rating = Math.max(0, Math.min(5, Number(genre.averageRating) || 0));
                  const yTop = 100 - ((rating / 5) * 100);
                  
                  return `
                    <div class="bubble-item"
                      data-tx="${x.toFixed(4)}"
                      data-ty="${yTop.toFixed(4)}"
                      data-r="${radius.toFixed(4)}"
                      style="
                        width: ${diameter.toFixed(2)}px;
                        height: ${diameter.toFixed(2)}px;
                        background-color: ${color};
                        left: ${x.toFixed(2)}%;
                        top: ${yTop.toFixed(2)}%;
                      "
                      title="${this.escapeHtml(genre.name)}: ${genre.count}권 (완독률 ${Number(genre.completionRate || 0).toFixed(1)}%, 평점 ${Number(genre.averageRating || 0).toFixed(1)}점)">
                      <div class="bubble-content">
                        <div class="bubble-label">${this.escapeHtml(genre.name)}</div>
                        <div class="bubble-count">${genre.count}권</div>
                      </div>
                    </div>
                  `;
                }).join('')
              }
            </div>
          </div>
        </div>
      </div>
    `;
    this.statsDisplay.innerHTML = html;

    // 버블 겹침 방지 레이아웃 적용 (렌더 이후 DOM 크기 기준으로 재배치)
    requestAnimationFrame(() => {
      this.layoutGenreBubbles();
    });
  }

  /**
   * 버블 차트 겹침 방지 레이아웃 (간단 force/packing)
   * - 목표 좌표(tx, ty) 주변으로 끌어당기되, 버블 간 충돌을 반복적으로 해소합니다.
   * - 공간이 부족한 경우 전체 반지름을 단계적으로 축소해 "겹치지 않음"을 우선 확보합니다.
   */
  layoutGenreBubbles() {
    if (!this.statsDisplay) return;
    const canvas = this.statsDisplay.querySelector('.bubble-chart-canvas');
    if (!canvas) return;

    const bubbleEls = Array.from(canvas.querySelectorAll('.bubble-item'));
    if (bubbleEls.length <= 1) return;

    const rect = canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    if (!width || !height) return;

    const basePadding = 10; // float 애니메이션(수 px)까지 고려한 여유 간격
    const minRadius = 18;

    const nodes = bubbleEls
      .map((el, idx) => {
        const txPct = Number(el.dataset.tx);
        const tyPct = Number(el.dataset.ty);
        const r = Math.max(minRadius, Number(el.dataset.r) || minRadius);

        const tx = (isFinite(txPct) ? txPct : 0) * (width / 100);
        const ty = (isFinite(tyPct) ? tyPct : 0) * (height / 100);

        // 초기 위치: 목표 좌표에서 아주 약간 흩뿌려 시작
        const angle = idx * 0.9;
        const jitter = 2;
        const x0 = tx + Math.cos(angle) * jitter;
        const y0 = ty + Math.sin(angle) * jitter;

        return {
          el,
          r,
          tx,
          ty,
          x: x0,
          y: y0,
          vx: 0,
          vy: 0
        };
      })
      // 큰 버블 먼저 안정적으로 자리 잡도록 정렬
      .sort((a, b) => b.r - a.r);

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const applySizeToDom = () => {
      nodes.forEach(n => {
        const d = n.r * 2;
        n.el.style.width = `${d}px`;
        n.el.style.height = `${d}px`;
        n.el.dataset.r = String(n.r);
      });
    };

    const maxOverlap = () => {
      let max = 0;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.hypot(dx, dy) || 0.0001;
          const minDist = a.r + b.r + basePadding;
          max = Math.max(max, minDist - dist);
        }
      }
      return max;
    };

    const simulate = (iterations = 240) => {
      const kAttract = 0.018; // 목표 좌표로 끌림
      const kRepel = 0.55;    // 충돌 해소 강도
      const damping = 0.6;    // 속도 감쇠

      for (let iter = 0; iter < iterations; iter++) {
        // 충돌 + 목표점으로 수렴
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];

          // 목표로 끌어당김
          a.vx += (a.tx - a.x) * kAttract;
          a.vy += (a.ty - a.y) * kAttract;

          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy) || 0.0001;
            const minDist = a.r + b.r + basePadding;

            if (dist < minDist) {
              const overlap = (minDist - dist) / dist;
              const pushX = dx * overlap * 0.5 * kRepel;
              const pushY = dy * overlap * 0.5 * kRepel;
              a.vx -= pushX;
              a.vy -= pushY;
              b.vx += pushX;
              b.vy += pushY;
            }
          }
        }

        let moved = 0;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          n.x += n.vx;
          n.y += n.vy;
          n.vx *= damping;
          n.vy *= damping;

          // 캔버스 내부로 클램프 (버블이 잘리지 않도록)
          n.x = clamp(n.x, n.r + basePadding, width - n.r - basePadding);
          n.y = clamp(n.y, n.r + basePadding, height - n.r - basePadding);

          moved += Math.abs(n.vx) + Math.abs(n.vy);
        }

        if (moved < 0.08) break;
      }
    };

    // 공간 부족 시: 전체 버블 크기를 단계적으로 줄이면서 "겹치지 않음"을 확보
    for (let attempt = 0; attempt < 6; attempt++) {
      simulate(260);
      if (maxOverlap() <= 0.6) break;

      // 그래도 겹치면: 전체 축소(비율 유지), 단 최소 반지름 보장
      nodes.forEach(n => {
        n.r = Math.max(minRadius, n.r * 0.92);
      });
      applySizeToDom();
    }

    // 최종 DOM 반영 (px 기반으로 위치 고정)
    nodes.forEach(n => {
      n.el.style.left = `${n.x}px`;
      n.el.style.top = `${n.y}px`;
    });
  }

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
