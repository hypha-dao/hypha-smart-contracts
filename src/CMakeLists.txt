cmake_minimum_required(VERSION 3.16)

project(hypha)

find_package(cdt)

add_contract( sale hypha.sale hypha.sale.cpp )
add_contract( login hypha.login login.cpp )
add_contract( joinhypha hypha.join hypha.accountcreator.cpp )
add_contract( startoken hypha.token seeds.startoken.cpp )

target_include_directories( hypha.sale PUBLIC ${CMAKE_SOURCE_DIR}/../include )
target_include_directories( hypha.login PUBLIC ${CMAKE_SOURCE_DIR}/../include )
target_include_directories( hypha.join PUBLIC ${CMAKE_SOURCE_DIR}/../include )
target_include_directories( hypha.token PUBLIC ${CMAKE_SOURCE_DIR}/../include )

