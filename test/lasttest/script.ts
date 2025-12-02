import http from 'k6/http';
// @ts-expect-error https://github.com/grafana/k6-jslib-testing
import { expect } from 'https://jslib.k6.io/k6-testing/0.5.0/index.js';
import { sleep } from 'k6';
import { type Options } from 'k6/options';
import { generateArtikelnummer } from './artikelnummer_generate.js';

const baseUrl = 'https://localhost:3000';
const restUrl = `${baseUrl}/rest`;
const tokenUrl = `${baseUrl}/auth/token`;
const dbPopulateUrl = `${baseUrl}/dev/db_populate`;

const ids = [1, 2, 3, 4, 5];

const neuesSchuh = () => ({
    artikelnummer: generateArtikelnummer(),
    bewertung: 1,
    typ: 'Sneaker',
    preis: 111.11,
    rabattsatz: 0.011,
    verfuegbar: true,
    erscheinungsdatum: '2024-02-10T00:00:00.000Z',
    homepage: 'https://post.rest',
    schlagwoerter: ['SPORT'],
    modell: {
        modell: 'k6-Modell',
        farbe: 'schwarz',
    },
    abbildungen: [
        {
            beschriftung: 'Abb. 1: k6',
            contentType: 'image/png',
        },
    ],
});

const tlsDir = '../../src/config/resources/tls';
const cert = open(`${tlsDir}/certificate.crt`);
const key = open(`${tlsDir}/key.pem`);

// Holt Token und triggert db_populate
export function setup() {
    const tokenHeaders = {
        'Content-Type': 'application/x-www-form-urlencoded',
    };
    const body = 'username=admin&password=p';
    const tokenResponse = http.post<'text'>(tokenUrl, body, {
        headers: tokenHeaders,
    });
    expect(tokenResponse.status).toBe(200);
    const token = JSON.parse(tokenResponse.body).access_token as string;

    const headers = { Authorization: `Bearer ${token}` };
    const res = http.post(dbPopulateUrl, undefined, { headers });
    expect(res.status).toBe(200);

    return { token };
}

export const options: Options = {
    batchPerHost: 20,
    scenarios: {
        get_id: {
            exec: 'getById',
            executor: 'ramping-vus',
            stages: [
                { target: 2, duration: '5s' },
                { target: 2, duration: '15s' },
                { target: 0, duration: '5s' },
            ],
        },
        post_schuh: {
            exec: 'postSchuh',
            executor: 'ramping-vus',
            stages: [
                { target: 1, duration: '5s' },
                { target: 1, duration: '15s' },
                { target: 0, duration: '5s' },
            ],
        },
    },
    tlsAuth: [
        {
            cert,
            key,
        },
    ],
    tlsVersion: http.TLS_1_3,
    insecureSkipTLSVerify: true,
};

// GET /rest/<id>
export function getById() {
    const id = ids[Math.floor(Math.random() * ids.length)];
    const response = http.get(`${restUrl}/${id}`);
    expect([200, 404]).toContain(response.status);
    sleep(1);
}

// POST /rest
export function postSchuh(data: { token: string }) {
    const payload = neuesSchuh();
    const requestHeaders = {
        Authorization: `Bearer ${data.token}`,
        'Content-Type': 'application/json',
    };
    const response = http.post(restUrl, JSON.stringify(payload), {
        headers: requestHeaders,
    });
    if ([201, 400, 409, 500].includes(response.status)) {
        // expected variants, 500 wird nur geloggt
        if (response.status === 500) {
            console.log(`postSchuh: status=500, body=${response.body}`);
        }
    } else {
        expect([201, 400, 409]).toContain(response.status);
    }
    sleep(1);
}
