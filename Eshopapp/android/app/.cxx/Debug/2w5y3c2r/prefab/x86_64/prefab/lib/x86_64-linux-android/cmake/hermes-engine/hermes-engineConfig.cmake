if(NOT TARGET hermes-engine::libhermes)
add_library(hermes-engine::libhermes SHARED IMPORTED)
set_target_properties(hermes-engine::libhermes PROPERTIES
    IMPORTED_LOCATION "C:/Users/Avijit/.gradle/caches/8.13/transforms/0a2afb941a6bfc41d3a30410b048f1dc/transformed/hermes-android-0.79.5-debug/prefab/modules/libhermes/libs/android.x86_64/libhermes.so"
    INTERFACE_INCLUDE_DIRECTORIES "C:/Users/Avijit/.gradle/caches/8.13/transforms/0a2afb941a6bfc41d3a30410b048f1dc/transformed/hermes-android-0.79.5-debug/prefab/modules/libhermes/include"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

