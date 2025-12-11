package com.example.virtualthreads.mapper;

import com.example.virtualthreads.dto.CreateUserRequest;
import com.example.virtualthreads.dto.UserResponse;
import com.example.virtualthreads.model.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper(componentModel = "spring")
public interface UserMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    User toEntity(CreateUserRequest request);

    UserResponse toResponse(User user);
}
