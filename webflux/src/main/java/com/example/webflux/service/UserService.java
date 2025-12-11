package com.example.webflux.service;

import com.example.webflux.dto.CreateUserRequest;
import com.example.webflux.dto.PageResponse;
import com.example.webflux.dto.UserResponse;
import com.example.webflux.mapper.UserMapper;
import com.example.webflux.model.User;
import com.example.webflux.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import reactor.core.publisher.Mono;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final UserMapper userMapper;

    @Transactional
    public Mono<UserResponse> createUser(CreateUserRequest request) {
        User user = userMapper.toEntity(request);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return userRepository.save(user)
                .map(userMapper::toResponse);
    }

    @Transactional(readOnly = true)
    public Mono<PageResponse<UserResponse>> getUsers(int page, int size) {
        int offset = page * size;

        return userRepository.countAll()
                .flatMap(totalElements -> {
                    int totalPages = (int) Math.ceil((double) totalElements / size);

                    return userRepository.findAllPaged(size, offset)
                            .map(userMapper::toResponse)
                            .collectList()
                            .map(users -> PageResponse.<UserResponse>builder()
                                    .content(users)
                                    .page(page)
                                    .size(size)
                                    .totalElements(totalElements)
                                    .totalPages(totalPages)
                                    .build());
                });
    }
}
