package com.readingtracker.server.service.read;

import com.readingtracker.dbms.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * Secondary DB 전용 User 조회 DAO (Failover용)
 */
@Component
public class SecondaryUserDao {

    @Autowired
    @Qualifier("secondaryNamedParameterJdbcTemplate")
    private NamedParameterJdbcTemplate secondaryNamedJdbcTemplate;

    private static final RowMapper<User> USER_ROW_MAPPER = new RowMapper<>() {
        @Override
        public User mapRow(ResultSet rs, int rowNum) throws SQLException {
            User user = new User();
            user.setId(rs.getLong("id"));
            user.setLoginId(rs.getString("login_id"));
            user.setEmail(rs.getString("email"));
            user.setName(rs.getString("name"));
            user.setPasswordHash(rs.getString("password_hash"));
            user.setRole(User.Role.valueOf(rs.getString("role")));
            user.setStatus(User.Status.valueOf(rs.getString("status")));
            user.setFailedLoginCount(rs.getInt("failed_login_count"));
            user.setLastLoginAt(rs.getTimestamp("last_login_at") != null ? rs.getTimestamp("last_login_at").toLocalDateTime() : null);
            user.setCreatedAt(rs.getTimestamp("created_at") != null ? rs.getTimestamp("created_at").toLocalDateTime() : null);
            user.setUpdatedAt(rs.getTimestamp("updated_at") != null ? rs.getTimestamp("updated_at").toLocalDateTime() : null);
            return user;
        }
    };

    public User findActiveByLoginId(String loginId) {
        String sql = """
                SELECT * FROM Users
                WHERE login_id = :loginId AND status = 'ACTIVE'
                LIMIT 1
                """;
        MapSqlParameterSource params = new MapSqlParameterSource("loginId", loginId);
        return secondaryNamedJdbcTemplate.query(sql, params, rs -> rs.next() ? USER_ROW_MAPPER.mapRow(rs, 0) : null);
    }

    public User findActiveByLoginIdAndEmail(String loginId, String email) {
        String sql = """
                SELECT * FROM Users
                WHERE login_id = :loginId AND email = :email AND status = 'ACTIVE'
                LIMIT 1
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("loginId", loginId)
                .addValue("email", email);
        return secondaryNamedJdbcTemplate.query(sql, params, rs -> rs.next() ? USER_ROW_MAPPER.mapRow(rs, 0) : null);
    }

    public User findById(Long id) {
        String sql = """
                SELECT * FROM Users
                WHERE id = :id
                LIMIT 1
                """;
        MapSqlParameterSource params = new MapSqlParameterSource("id", id);
        return secondaryNamedJdbcTemplate.query(sql, params, rs -> rs.next() ? USER_ROW_MAPPER.mapRow(rs, 0) : null);
    }
}


