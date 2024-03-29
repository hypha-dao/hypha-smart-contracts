#pragma once
#include "hypha_common.hpp"

#define __NARG__(...)  __NARG_I_(__VA_ARGS__,__RSEQ_N())
#define __NARG_I_(...) __ARG_N(__VA_ARGS__)
#define __ARG_N(\
      _1, _2, _3, _4, _5, _6, _7, _8, _9,_10,\
     _11,_12,_13,_14,_15,_16,_17,_18,_19,_20,\
     _21,_22,_23,_24,_25,_26,_27,_28,_29,_30,\
     _31,_32,_33,_34,_35,_36,_37,_38,_39,_40,\
     _41,_42,_43,_44,_45,_46,_47,_48,_49,_50,\
     _51,_52,_53,_54,_55,_56,_57,_58,_59,_60,\
     N,...) N
     
#define __RSEQ_N()\
60,100,100,100,56,100,100,100,52,100 ,\
100,100,48,100,100,100,44,100,100,100 ,\
40,100,100,100,36,100,100,100,32,100 ,\
100,100,28,100,100,100,24,100,100,100 ,\
20,100,100,100,16,100,100,100,12,100 ,\
100,100,8,100,100,100,4,100,100,100


#define CONCATENATE(arg1, arg2)   CONCATENATE1(arg1, arg2)
#define CONCATENATE1(arg1, arg2)  CONCATENATE2(arg1, arg2)
#define CONCATENATE2(arg1, arg2)  arg1##arg2

#define FOR_EACH_(N, what, ...) CONCATENATE(FOR_EACH_PACK, N)(what, __VA_ARGS__)
#define FOR_EACH(what, ...) FOR_EACH_(__NARG__(__VA_ARGS__), what, __VA_ARGS__)

#define FOR_EACH_PACK100(action,a,b,c,d,...) static_assert(false, "Invalid amount of parameters");

#define FOR_EACH_PACK4(action,a,b,c,d,...)\
    action(a,b,c,d)                        

#define FOR_EACH_PACK8(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK4(action, __VA_ARGS__)

#define FOR_EACH_PACK12(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK8(action, __VA_ARGS__)

#define FOR_EACH_PACK16(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK12(action, __VA_ARGS__)

#define FOR_EACH_PACK20(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK16(action, __VA_ARGS__)

#define FOR_EACH_PACK24(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK20(action, __VA_ARGS__)

#define FOR_EACH_PACK28(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK24(action, __VA_ARGS__)

#define FOR_EACH_PACK32(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK28(action, __VA_ARGS__)

#define FOR_EACH_PACK36(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK32(action, __VA_ARGS__)

#define FOR_EACH_PACK40(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK36(action, __VA_ARGS__)

#define FOR_EACH_PACK44(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK40(action, __VA_ARGS__)

#define FOR_EACH_PACK48(action,a,b,c,d,...)\
    action(a,b,c,d)\
    FOR_EACH_PACK44(action, __VA_ARGS__)


#define PROPERTY(name, type, getSet, useGetSet) name, type, getSet, useGetSet

#define DECLARE_DATA_MEMBER(name, type, _u, _v) type name;
#define DECLARE_DATA_STRUCT(structName, ...)\
struct structName {\
FOR_EACH(DECLARE_DATA_MEMBER, __VA_ARGS__)\
};

#define USE_GETSET USE
#define NO_USE_GETSET NO_USE
#define USE_GET USE_ONLY_GET

#define NO_USE_GET_SET_DEC(name, type, getSet)

#define USE_ONLY_GET_GET_SET_DEC(name, type, getSet)\
const type& get##getSet() {\
    return getContentWrapper()\
          .getOrFail(DETAILS, #name)\
          ->getAs<type>();\
}

#define USE_GET_SET_DEC(name, type, getSet)\
const type& get##getSet() {\
    return getContentWrapper()\
          .getOrFail(DETAILS, #name)\
          ->getAs<type>();\
}\
void set##getSet(type value) {\
    auto cw = getContentWrapper();\
    cw.insertOrReplace(\
        *cw.getGroupOrFail(DETAILS),\
        Content{ #name, std::move(value) }\
    );\
}

#define DECLARE_GET_SET(name, type, getSet, useGetSet) CONCATENATE(useGetSet, _GET_SET_DEC)(name,type,getSet)

#define DECLARE_METHODS(...)\
FOR_EACH(DECLARE_GET_SET, __VA_ARGS__)

#define CONVERT_FIELD(name, _u, _v, _w) Content{#name, std::move(data.name)},
#define DECLARE_CONVERT(structName, ...)\
ContentGroups convert(structName data) {\
    return ContentGroups {\
        ContentGroup {\
            { CONTENT_GROUP_LABEL, DETAILS },\
            FOR_EACH(CONVERT_FIELD, __VA_ARGS__)\
        }\
    };\
}

#define DECLARE_DOCUMENT(structName, ...)\
public:\
DECLARE_DATA_STRUCT(structName, __VA_ARGS__)\
DECLARE_METHODS(__VA_ARGS__)\
private:\
DECLARE_CONVERT(structName, __VA_ARGS__)