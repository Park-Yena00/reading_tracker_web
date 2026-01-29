/**
 * 통계 계산 헬퍼 유틸리티
 * 데이터 가공 및 집계 로직을 담당 (순수 함수 위주)
 */

export const StatisticsHelper = {
  /**
   * 일별 독서 타임 트래커 데이터 계산
   * @param {Object} memosByBook - TodayFlowResponse의 memosByBook 데이터
   * @returns {Array} 가공된 타임라인 데이터
   */
  calculateDailyTimeTrack(memosByBook) {
    if (!memosByBook) return [];

    const timeTracks = Object.values(memosByBook).map(group => {
      if (!group.memos || group.memos.length === 0) return null;

      // 메모 시간 추출 및 정렬 (로컬 시간대 고려)
      const times = group.memos
        .map(m => new Date(m.memoStartTime || m.createdAt).getTime())
        .filter(t => !isNaN(t));

      if (times.length === 0) return null;

      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      return {
        bookId: group.bookId,
        bookTitle: group.bookTitle || '제목 없음',
        author: group.memos[0].author || '', 
        startTime: new Date(minTime),
        endTime: new Date(maxTime),
        durationMinutes: Math.round((maxTime - minTime) / (1000 * 60))
      };
    }).filter(Boolean);

    // 시작 시간 기준 정렬
    return timeTracks.sort((a, b) => a.startTime - b.startTime);
  },

  /**
   * 방치한 책 BEST 3 계산 (설계 문서 3.2 로직 반영)
   * 1순위: 메모 기록이 있는 책 중 마지막 메모일이 가장 오래된 순 (완독 제외)
   * 2순위: 메모 없는 책 중 미완독 도서를 서재 등록일이 오래된 순으로 보충 (완독 제외)
   * @param {Array} allBooks - 전체 도서 목록
   * @param {Array} recentActivityResults - 최근 활동 도서 목록 (BookResponse[] {id, lastMemoTime})
   * @returns {Array} BEST 3 도서 목록
   */
  getNeglectedBooks(allBooks, recentActivityResults = []) {
    // 1. 메모 이력이 있는 책들 추출 및 마지막 활동 시간 매핑
    const activityMap = new Map();
    recentActivityResults.forEach(item => {
      // 서버의 BookResponse.id가 UserShelfBook.id에 대응됨
      const bookId = item.id || item.userBookId || item.bookId;
      const lastTimeStr = item.lastMemoTime || item.updatedAt;
      if (bookId && lastTimeStr) {
        const lastTime = new Date(lastTimeStr).getTime();
        activityMap.set(String(bookId), lastTime);
      }
    });

    // 1순위: 활동 이력 있는 책 필터링 및 정렬 (완독 제외, 가장 오래된 순)
    const booksWithActivity = allBooks
      .filter(b => activityMap.has(String(b.userBookId)) && b.category !== 'Finished')
      .map(b => ({
        ...b,
        lastActivityTime: activityMap.get(String(b.userBookId)),
        hasMemo: true
      }))
      .sort((a, b) => a.lastActivityTime - b.lastActivityTime);

    // 2순위: 활동 이력 없는 책 추출 및 서재 등록일 기준 정렬 (완독 제외)
    const booksNoActivity = allBooks
      .filter(b => !activityMap.has(String(b.userBookId)) && b.category !== 'Finished')
      .map(b => ({
        ...b,
        lastActivityTime: new Date(b.addedAt || b.createdAt || 0).getTime(),
        hasMemo: false
      }))
      .sort((a, b) => a.lastActivityTime - b.lastActivityTime);

    // 3. 우선순위에 따라 병합하여 상위 3권 추출
    const merged = [...booksWithActivity, ...booksNoActivity];
    return merged.slice(0, 3);
  },

  /**
   * 연별 통계 (카테고리별 집계 및 장르 분포) 계산
   * @param {Array} books - 전체 도서 목록
   * @returns {Object} { categoryCounts, genreStats }
   */
  calculateYearlyStats(books) {
    const categoryCounts = {
      ToRead: 0,
      Reading: 0,
      AlmostFinished: 0,
      Finished: 0
    };

    const genreMap = new Map();
    
    books.forEach(book => {
      // 카테고리 집계
      if (categoryCounts.hasOwnProperty(book.category)) {
        categoryCounts[book.category]++;
      }

      // 장르 집계 (3번째 수준 또는 마지막 수준으로 그룹화)
      if (book.mainGenre) {
        const parts = book.mainGenre.split('>');
        // 3번째 장르 추출 (인덱스 2), 없으면 가장 마지막 장르 추출
        const displayName = parts.length >= 3 ? parts[2].trim() : parts[parts.length - 1].trim();
        
        let stats = genreMap.get(displayName);
        if (!stats) {
          stats = { name: displayName, count: 0, finishedCount: 0, totalRating: 0, ratedCount: 0 };
          genreMap.set(displayName, stats);
        }
        
        stats.count++;
        if (book.category === 'Finished') stats.finishedCount++;
        if (book.rating && book.rating > 0) {
          stats.totalRating += book.rating;
          stats.ratedCount++;
        }
      }
    });

    // 장르 통계 가공 (완독률, 평점 계산)
    const genreStats = Array.from(genreMap.values())
      .map(s => ({
        name: s.name,
        count: s.count,
        completionRate: (s.finishedCount / s.count) * 100,
        averageRating: s.ratedCount > 0 ? (s.totalRating / s.ratedCount) : 0
      }))
      .sort((a, b) => b.count - a.count);

    return { categoryCounts, genreStats };
  }
};
