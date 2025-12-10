package com.readingtracker.server.service.read;

import com.readingtracker.server.common.exception.DatabaseUnavailableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.function.Supplier;

/**
 * MySQL 이중화를 위한 Read Failover 서비스
 * Primary에서 읽기 시도 → 실패 시 Secondary로 Failover
 */
@Service
public class DualMasterReadService {

    private static final Logger log = LoggerFactory.getLogger(DualMasterReadService.class);

    @Autowired
    @Qualifier("primaryTransactionManager")
    private PlatformTransactionManager primaryTxManager;

    @Autowired
    @Qualifier("secondaryTransactionManager")
    private PlatformTransactionManager secondaryTxManager;

    @Autowired
    @Qualifier("primaryJdbcTemplate")
    private JdbcTemplate primaryJdbcTemplate;

    @Autowired
    @Qualifier("secondaryJdbcTemplate")
    private JdbcTemplate secondaryJdbcTemplate;

    /**
     * Primary에서 읽기 시도, 실패 시 Secondary로 Failover (단일 Supplier 호환)
     */
    public <T> T readWithFailover(Supplier<T> readOperation) {
        return readWithFailover(readOperation, readOperation);
    }

    /**
     * Primary에서 읽기 시도, 실패 시 Secondary 전용 작업으로 Failover
     */
    public <T> T readWithFailover(Supplier<T> primaryRead, Supplier<T> secondaryRead) {
        // Primary에서 시도
        try {
            TransactionTemplate txTemplate = new TransactionTemplate(primaryTxManager);
            T result = txTemplate.execute(status -> primaryRead.get());

            log.debug("Primary DB 읽기 성공");
            return result;

        } catch (Exception e) {
            log.warn("Primary DB 읽기 실패, Secondary DB로 전환", e);

            // Secondary에서 시도 (전용 작업 사용)
            try {
                TransactionTemplate txTemplate = new TransactionTemplate(secondaryTxManager);
                T result = txTemplate.execute(status -> secondaryRead.get());

                log.info("Secondary DB 읽기 성공 (Failover)");
                return result;

            } catch (Exception e2) {
                log.error("Secondary DB 읽기도 실패", e2);
                throw new DatabaseUnavailableException("모든 DB 접근 실패", e2);
            }
        }
    }
}


