package com.example.webflux.repository;

import com.example.webflux.model.User;
import org.springframework.data.r2dbc.repository.Query;
import org.springframework.data.repository.reactive.ReactiveCrudRepository;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@Repository
public interface UserRepository extends ReactiveCrudRepository<User, Long> {

    @Query("SELECT * FROM users ORDER BY id LIMIT :limit OFFSET :offset")
    Flux<User> findAllPaged(int limit, int offset);

    @Query("SELECT COUNT(*) FROM users")
    Mono<Long> countAll();
}
