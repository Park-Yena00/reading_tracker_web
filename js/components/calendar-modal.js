/**
 * 캘린더 모달 컴포넌트
 * 한달 캘린더를 렌더링하고 날짜 선택 처리
 */

import memoService from '../services/memo-service.js';

export class CalendarModal {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth() + 1; // 1-12
    this.memoDates = []; // 메모가 작성된 날짜 목록
    this.selectedDate = null;
    this.onDateSelect = null; // 날짜 선택 콜백
    
    this.init();
  }

  /**
   * 초기화
   */
  init() {
    if (!this.container) {
      console.error('Calendar modal container not found');
      return;
    }

    // 모달 닫기 버튼 및 배경 클릭 (이벤트 위임 사용)
    this.container.addEventListener('click', (e) => {
      // 모달 배경 클릭 시 닫기
      if (e.target === this.container) {
        this.hide();
        return;
      }
      
      // 닫기 버튼 클릭
      if (e.target.closest('.modal-close')) {
        this.hide();
        return;
      }
    });

    // 캘린더 컨테이너 이벤트 위임 (한 번만 등록)
    const calendarContainer = this.container.querySelector('#calendar-container');
    if (calendarContainer) {
      calendarContainer.addEventListener('click', (e) => {
        const prevBtn = e.target.closest('.calendar-nav-btn.prev');
        const nextBtn = e.target.closest('.calendar-nav-btn.next');
        const dayEl = e.target.closest('.calendar-day');
        
        if (prevBtn) {
          e.preventDefault();
          this.navigateMonth(-1);
        } else if (nextBtn) {
          e.preventDefault();
          this.navigateMonth(1);
        } else if (dayEl) {
          const date = dayEl.dataset.date;
          if (date) {
            this.handleDateClick(date);
          }
        }
      });
    }
  }

  /**
   * 모달 표시
   * @param {Function} onDateSelect - 날짜 선택 콜백 함수
   */
  async show(onDateSelect = null) {
    if (!this.container) return;
    
    this.onDateSelect = onDateSelect;
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth() + 1;
    
    this.container.style.display = 'flex';
    await this.render();
  }

  /**
   * 모달 숨김
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }

  /**
   * 캘린더 렌더링
   */
  async render() {
    const calendarContainer = this.container.querySelector('#calendar-container');
    if (!calendarContainer) return;

    // 메모 작성 날짜 목록 로드
    await this.loadMemoDates();

    // 캘린더 HTML 생성
    const calendarHtml = this.generateCalendarHtml();
    calendarContainer.innerHTML = calendarHtml;

    // 이벤트 위임은 init()에서 한 번만 등록되므로 여기서는 HTML만 업데이트
  }

  /**
   * 메모 작성 날짜 목록 로드
   */
  async loadMemoDates() {
    try {
      this.memoDates = await memoService.getMemoDates(this.currentYear, this.currentMonth);
    } catch (error) {
      console.error('메모 작성 날짜 목록 로드 오류:', error);
      this.memoDates = [];
    }
  }

  /**
   * 캘린더 HTML 생성
   * @returns {string} HTML 문자열
   */
  generateCalendarHtml() {
    const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay(); // 0 (일요일) ~ 6 (토요일)

    const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

    let html = `
      <div class="calendar-header">
        <button class="calendar-nav-btn prev">‹</button>
        <div class="calendar-month-year">${this.currentYear}년 ${monthNames[this.currentMonth - 1]}</div>
        <button class="calendar-nav-btn next">›</button>
      </div>
      <div class="calendar-grid">
    `;

    // 요일 헤더
    dayNames.forEach(day => {
      html += `<div class="calendar-day-header">${day}</div>`;
    });

    // 빈 칸 (첫 날 이전)
    for (let i = 0; i < startDayOfWeek; i++) {
      html += '<div class="calendar-day other-month"></div>';
    }

    // 날짜 셀
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isToday = today.getFullYear() === this.currentYear &&
                     today.getMonth() + 1 === this.currentMonth &&
                     today.getDate() === day;
      const hasMemo = this.memoDates.includes(dateStr);
      
      let classes = 'calendar-day';
      if (isToday) classes += ' today';
      if (hasMemo) classes += ' has-memo';
      
      html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
    }

    // 빈 칸 (마지막 날 이후)
    const totalCells = startDayOfWeek + daysInMonth;
    const remainingCells = 7 - (totalCells % 7);
    if (remainingCells < 7) {
      for (let i = 0; i < remainingCells; i++) {
        html += '<div class="calendar-day other-month"></div>';
      }
    }

    html += '</div>';
    return html;
  }

  /**
   * 월 이동
   * @param {number} delta - 이동할 월 수 (-1: 이전 달, 1: 다음 달)
   */
  async navigateMonth(delta) {
    this.currentMonth += delta;
    if (this.currentMonth < 1) {
      this.currentMonth = 12;
      this.currentYear--;
    } else if (this.currentMonth > 12) {
      this.currentMonth = 1;
      this.currentYear++;
    }
    await this.render();
  }

  /**
   * 날짜 클릭 처리
   * @param {string} date - 선택된 날짜 (YYYY-MM-DD)
   */
  handleDateClick(date) {
    const hasMemo = this.memoDates.includes(date);
    
    if (hasMemo) {
      // 메모가 있는 날짜: 콜백 호출
      if (this.onDateSelect) {
        this.onDateSelect(date);
      }
      this.hide();
    } else {
      // 메모가 없는 날짜: 안내 메시지
      alert('해당 날짜에 작성된 메모가 없습니다.');
    }
  }
}

export default CalendarModal;

