require('dotenv').config();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');
const fs = require('fs');

// Stealth 플러그인 추가 - 봇 탐지 우회
puppeteer.use(StealthPlugin());

const JANDI_WEBHOOK_URL = process.env.JANDI_WEBHOOK_URL;
const TARGET_CLINIC_NAME = '티유치과의원';
const KEYWORDS = [
    '임플란트',
    '치아미백',
    '잇몸성형',
    '라미네이트',
    '치아교정'
];

if (!JANDI_WEBHOOK_URL) {
    console.error('JANDI_WEBHOOK_URL 환경 변수를 설정해야 합니다.');
    process.exit(1);
}

const GITHUB_REPO_URL = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/${process.env.GITHUB_REF_NAME}`;

// 랜덤 대기 함수 (더 긴 시간)
async function randomDelay(min = 5000, max = 10000) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log(`봇 탐지 방지를 위해 ${delay}ms 대기...`);
    await new Promise(resolve => setTimeout(resolve, delay));
}

// 실제 사용자처럼 페이지 스크롤
async function humanLikeScroll(page) {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight / 2) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100);
        });
    });
}

async function main() {
    // 스크린샷 디렉토리 생성
    if (!fs.existsSync('screenshots')) {
        fs.mkdirSync('screenshots', { recursive: true });
    }

    console.log('바비톡 키워드 순위 확인 시작');
    const resultsByKeyword = {};

    const browser = await puppeteer.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu',
            '--window-size=1920,1080',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
            '--disable-site-isolation-trials'
        ]
    });

    const page = await browser.newPage();

    // User-Agent 설정 (최신 Chrome)
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    // 뷰포트 설정
    await page.setViewport({ width: 1920, height: 1080 });

    // 추가 헤더 설정
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Cache-Control': 'max-age=0'
    });

    // 추가 봇 탐지 우회 설정
    await page.evaluateOnNewDocument(() => {
        // WebDriver 감지 우회
        Object.defineProperty(navigator, 'webdriver', {
            get: () => false,
        });

        // Chrome 객체 추가
        window.chrome = {
            runtime: {},
        };

        // Permissions API 우회
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
            parameters.name === 'notifications' ?
                Promise.resolve({ state: Notification.permission }) :
                originalQuery(parameters)
        );

        // Plugin 배열 설정
        Object.defineProperty(navigator, 'plugins', {
            get: () => [1, 2, 3, 4, 5],
        });

        // Languages 설정
        Object.defineProperty(navigator, 'languages', {
            get: () => ['ko-KR', 'ko', 'en-US', 'en'],
        });
    });

    // 디버깅을 위해 브라우저 콘솔 로그를 Node.js 터미널로 출력
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    // 메인 페이지 접속 테스트
    console.log('메인 페이지 접속 테스트 중...');
    try {
        const mainResponse = await page.goto('https://web.babitalk.com/', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        console.log(`메인 페이지 응답 코드: ${mainResponse.status()}`);

        // 실제 사용자처럼 잠시 대기
        await randomDelay(3000, 5000);

        // 페이지 스크롤
        await humanLikeScroll(page);

        await page.screenshot({ path: 'screenshots/main_page_test.png', fullPage: true });
        console.log('메인 페이지 접속 성공');
    } catch (e) {
        console.error('메인 페이지 접속 실패:', e.message);
    }

    for (const keyword of KEYWORDS) {
        // 각 키워드 검색 전 충분한 대기 (5-10초)
        if (keyword !== KEYWORDS[0]) {
            await randomDelay(5000, 10000);
        } else {
            // 첫 번째 키워드도 잠시 대기
            await randomDelay(3000, 5000);
        }

        console.log(`'${keyword}' 키워드 검색 중...`);
        const url = `https://web.babitalk.com/search?keyword=${encodeURIComponent(keyword)}`;

        try {
            const response = await page.goto(url, {
                waitUntil: 'networkidle2',
                timeout: 60000
            });
            console.log(`'${keyword}' 응답 코드: ${response.status()}`);

            // 페이지 로딩 후 추가 대기
            await randomDelay(2000, 4000);

            // 더보기 버튼 클릭
            console.log(`'${keyword}' 더보기 버튼 확인 중...`);
            try {
                // XPath: /html/body/div[1]/div[2]/div/div/div[2]/div[2]/div[1]/div[1]/button
                const moreButtonXPath = '/html/body/div[1]/div[2]/div/div/div[2]/div[2]/div[1]/div[1]/button';
                const hasMoreButton = await page.evaluate((xpath) => {
                    const button = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
                    if (button) {
                        button.click();
                        return true;
                    }
                    return false;
                }, moreButtonXPath);

                if (hasMoreButton) {
                    console.log('더보기 버튼 클릭 - 무한 스크롤 활성화');
                    await randomDelay(2000, 3000);
                } else {
                    console.log('더보기 버튼 없음');
                }
            } catch (e) {
                console.log('더보기 버튼 처리 중 오류:', e.message);
            }

            // 스크롤하면서 모든 리스트 로드 (무한 스크롤)
            console.log('무한 스크롤로 모든 리스트 로딩 중...');
            let previousHeight = 0;
            let currentHeight = await page.evaluate(() => document.body.scrollHeight);
            let scrollAttempts = 0;
            const maxScrollAttempts = 20; // 최대 20번 스크롤 시도

            while (scrollAttempts < maxScrollAttempts) {
                // 천천히 스크롤
                await page.evaluate(() => {
                    window.scrollBy(0, 500);
                });

                // 로딩 대기 (천천히)
                await randomDelay(1500, 2500);

                // 높이 변화 확인
                previousHeight = currentHeight;
                currentHeight = await page.evaluate(() => document.body.scrollHeight);

                if (currentHeight === previousHeight) {
                    // 한 번 더 시도 (더 이상 로드할 콘텐츠 확인)
                    await page.evaluate(() => window.scrollBy(0, 500));
                    await randomDelay(2000, 3000);
                    const finalHeight = await page.evaluate(() => document.body.scrollHeight);

                    if (finalHeight === currentHeight) {
                        console.log('더 이상 로드할 리스트 없음 - 완료');
                        break;
                    } else {
                        currentHeight = finalHeight;
                    }
                }

                scrollAttempts++;
                console.log(`스크롤 진행 중... (${scrollAttempts}/${maxScrollAttempts}) - 높이: ${currentHeight}px`);
            }

            // 맨 위로 스크롤백 (스크린샷 전)
            await page.evaluate(() => window.scrollTo(0, 0));
            await randomDelay(1000, 2000);

            // 풀 스크린샷 저장
            const screenshotPath = `screenshots/${keyword}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`'${keyword}' 풀 스크린샷 저장 완료`);

            // 결과 파싱
            const results = await page.evaluate((TARGET_CLINIC_NAME) => {
                const scrapedData = [];
                // 검색 결과 블록 div의 Xpath: /html/body/div[1]/div[2]/div/div/div[2]/div[1]/div/div[3]
                const resultsBlockXPath = '/html/body/div[1]/div[2]/div/div/div[2]/div[1]/div/div[3]';
                const resultsBlock = document.evaluate(resultsBlockXPath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                if (!resultsBlock) {
                    return scrapedData;
                }

                // 하위 div가 이벤트 리스트
                const eventDivs = resultsBlock.querySelectorAll(':scope > div');

                eventDivs.forEach((eventDiv, index) => {
                    try {
                        // 병원명 Xpath 상대 경로: ./div/div[2]/p[2]
                        const hospitalNameNode = document.evaluate('./div/div[2]/p[2]', eventDiv, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                        if (hospitalNameNode && hospitalNameNode.textContent.includes(TARGET_CLINIC_NAME)) {
                            // 이벤트명 Xpath 상대 경로: ./div/div[1]/div
                            const eventNameNode = document.evaluate('./div/div[1]/div', eventDiv, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                            // 평점 Xpath 상대 경로: ./div/div[4]/h5
                            const starRatingNode = document.evaluate('./div/div[4]/h5', eventDiv, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                            // 리뷰개수 Xpath 상대 경로: ./div/div[4]/p
                            const reviewCountNode = document.evaluate('./div/div[4]/p', eventDiv, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;

                            scrapedData.push({
                                rank: index + 1, // 순서가 순위
                                eventName: eventNameNode ? eventNameNode.textContent.trim() : 'N/A',
                                starRating: starRatingNode ? starRatingNode.textContent.trim() : 'N/A',
                                reviewCount: reviewCountNode ? reviewCountNode.textContent.trim() : 'N/A',
                            });
                        }
                    } catch (e) {
                        console.log(`이벤트 ${index + 1} 파싱 중 오류:`, e.message);
                    }
                });

                return scrapedData;
            }, TARGET_CLINIC_NAME);

            resultsByKeyword[keyword] = results;
            console.log(`'${keyword}' 검색 완료: ${results.length}개 결과 발견`);
        } catch (e) {
            console.error(`'${keyword}' 검색 실패:`, e.message);
            resultsByKeyword[keyword] = [];
        }
    }

    await browser.close();

    await sendJandiNotification(resultsByKeyword);

    console.log('작업 완료');
}

async function sendJandiNotification(results) {
    console.log('Jandi로 결과 전송 중...');

    let messageBody = '';
    for (const keyword of KEYWORDS) {
        messageBody += `### 🦷 ${keyword}\n`;
        const screenshotUrl = `${GITHUB_REPO_URL}/screenshots/${encodeURIComponent(keyword)}.png`;

        if (results[keyword] && results[keyword].length > 0) {
            results[keyword].forEach(item => {
                messageBody += `**[${item.eventName}]**\n`;
                messageBody += `* 검색어 순위: **${item.rank}위**\n`;
                messageBody += `* 별점: ${item.starRating}\n`;
                messageBody += `* 리뷰개수: ${item.reviewCount}\n`;
            });
        } else {
            messageBody += '❌ **리스트에 없음**\n';
        }
        messageBody += `[스크린샷 보기](${screenshotUrl})\n\n`;
    }

    if (messageBody === '') {
        messageBody = '금일 바비톡 이벤트 목록에서 해당 병원을 찾지 못했습니다.';
    }

    const payload = {
        body: `📢 바비톡 키워드 순위 리포트 (${new Date().toLocaleDateString('ko-KR')})`,
        connectColor: '#FF6B9D',
        connectInfo: [
            {
                title: '🥇 바비톡 키워드별 순위',
                description: messageBody
            }
        ]
    };

    try {
        await axios.post(JANDI_WEBHOOK_URL, payload, {
            headers: {
                'Accept': 'application/vnd.tosslab.jandi-v2+json',
                'Content-Type': 'application/json'
            }
        });
        console.log('Jandi 알림 전송 성공');
    } catch (error) {
        console.error('Jandi 알림 전송 실패:', error.message);
    }
}

main().catch(error => {
    console.error('스크립트 실행 중 오류 발생:', error);
    process.exit(1);
});
