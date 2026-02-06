
### 개요
매일 바비톡 웹페이지의 키워드에서 우리 병원이 몇위에 있는지를 체크 해야해
그리고 이 정보를 잔디로 보고 할꺼야 
스크린샷도 찍어야해

### 자사 정보
1. 치과이름 : 티유치과의원

### 키워드 종류
- 임플란트
- 치아미백
- 잇몸성형
- 라미네이트
- 치아교정

### 바비톡 웹페이지 xPath 정보
1. URL : https://web.babitalk.com/search?keyword={KeyWord}
2. 최초 접속 후 더보기 버튼 Xpath : /html/body/div[1]/div[2]/div/div/div[2]/div[2]/div[1]/div[1]/button
3. 검색 결과 블록 div의 Xpath : /html/body/div[1]/div[2]/div/div/div[2]/div[1]/div/div[3]
    - 해당 속성 하위 div 가 이벤트 리스트이며, 해당 순서가 검색어 순위 임 
4. 이벤트명 Xpath : /html/body/div[1]/div[2]/div/div/div[2]/div[1]/div/div[3]/div[1]/div/div[1]/div
5. 병원명 Xpath : /html/body/div[1]/div[2]/div/div/div[2]/div[1]/div/div[3]/div[1]/div/div[2]/p[2]
6. 평점 Xpath : /html/body/div[1]/div[2]/div/div/div[2]/div[1]/div/div[3]/div[1]/div/div[4]/h5
7. 리뷰개수 Xpath : /html/body/div[1]/div[2]/div/div/div[2]/div[1]/div/div[3]/div[1]/div/div[4]/p

### 스크린샷
- 처음 url 접속 -> 더보기 버튼 클릭 -> 무한 스크롤 방식(천천히 스크롤 내리면서 더 안나올 때 까지 스크롤 해야 함) -> 다 하고 풀 스크린샷 필요

### 잔디 메시지 예시
1. 라미네이트
    1) 제로네이트 베이직, 교정 라미네이트
        - 검색어 순위 : 1 위
        - 별점 : 9.9
        - 리뷰개수 : 1,235개
    2) 제로네이트 화이트, 라미네이트
        - 검색어 순위 : 2 위
        - 별점 : 9.9
        - 리뷰개수 : 1,235개
2. 임플란트
    1) 정품 오스템BA임플란트
        - 검색어 순위 : 1 위
        - 별점 : 9.9
        - 리뷰개수 : 1,235개

### 잔디 웹 훅 URL 


### 비고
1. 하나의 키워드에서 우리 병원이 여러 이벤트가 있을 수 있다
2. 깃헙에서 깃헙액션으로 할꺼야 
3. 매일 아침 8시에 보고하게 할꺼야
4. 잔디 웹 훅 URL 은 깃헙에서 Repository secrets 으로 등록 할꺼야