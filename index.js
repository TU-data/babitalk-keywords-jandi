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
            let scrollAttempts = 0;
            const maxScrollAttempts = 20;

            while (scrollAttempts < maxScrollAttempts) {
                const currentHeight = await page.evaluate(() => {
                    window.scrollTo(0, document.body.scrollHeight);
                    return document.body.scrollHeight;
                });

                await randomDelay(2000, 3000);

                const newHeight = await page.evaluate(() => document.body.scrollHeight);

                if (newHeight === previousHeight) {
                    console.log('더 이상 로드할 리스트 없음 - 완료');
                    break;
                }

                previousHeight = newHeight;
                scrollAttempts++;
                console.log(`스크롤 진행 중... (${scrollAttempts}/${maxScrollAttempts}) - 높이: ${newHeight}px`);
            }

            // 맨 위로 스크롤백 (스크린샷 전)
            await page.evaluate(() => window.scrollTo(0, 0));
            await randomDelay(1000, 2000);

            // 풀 스크린샷 저장
            const screenshotPath = `screenshots/${keyword}.png`;
            await page.screenshot({ path: screenshotPath, fullPage: true });
            console.log(`'${keyword}' 풀 스크린샷 저장 완료`);

            // 결과 파싱 (XPath 없이 텍스트 기반 탐색)
            const results = await page.evaluate((TARGET_CLINIC_NAME) => {
                // 정확히 일치하는 텍스트 노드의 부모 요소 찾기
                function findExactTextElements(text) {
                    const found = [];
                    const walk = (node) => {
                        if (node.nodeType === Node.TEXT_NODE && node.textContent.trim() === text) {
                            found.push(node.parentElement);
                        }
                        for (const child of node.childNodes) walk(child);
                    };
                    walk(document.body);
                    return found;
                }

                // 카드 내부 섹션(~4개 형제)을 건너뛰고 실제 이벤트 리스트 아이템 탐색
                function findCardInList(el, minSiblings = 10) {
                    let node = el;
                    while (node.parentElement && node.parentElement !== document.body) {
                        if (node.parentElement.children.length >= minSiblings) return node;
                        node = node.parentElement;
                    }
                    return null;
                }

                const scrapedData = [];
                const clinicEls = findExactTextElements(TARGET_CLINIC_NAME);
                const seenCards = new Set();

                clinicEls.forEach(el => {
                    const card = findCardInList(el);
                    if (!card || seenCards.has(card)) return;
                    seenCards.add(card);

                    const rank = Array.from(card.parentElement.children).indexOf(card) + 1;

                    // 별점: 카드 내 h5 직접 탐색
                    const h5 = card.querySelector('h5');
                    const starRating = h5 ? h5.textContent.trim() : 'N/A';

                    // 리뷰수: h5 바로 다음 p 요소
                    const reviewP = h5 ? h5.nextElementSibling : null;
                    const reviewCount = (reviewP && reviewP.tagName === 'P') ? reviewP.textContent.trim() : 'N/A';

                    // 이벤트명: 병원명/별점/리뷰수를 제외한 첫 번째 텍스트
                    const lines = (card.innerText || card.textContent)
                        .split('\n')
                        .map(s => s.trim())
                        .filter(Boolean);

                    const eventName = lines.find(l =>
                        l !== TARGET_CLINIC_NAME &&
                        l !== starRating &&
                        l !== reviewCount &&
                        l.length >= 3
                    ) || 'N/A';

                    scrapedData.push({ rank, eventName, starRating, reviewCount });
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
