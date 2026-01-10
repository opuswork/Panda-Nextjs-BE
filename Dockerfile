FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
# DB 구조 동기화를 위해 스키마 파일 복사
COPY prisma ./prisma/

RUN npm install

COPY . .

# ✅ BE용 entrypoint.sh 복사 및 권한 설정
COPY entrypoint.sh /usr/bin/
RUN chmod +x /usr/bin/entrypoint.sh

# ✅ 실행 순서 보장
ENTRYPOINT ["/usr/bin/entrypoint.sh"]

EXPOSE 4000

CMD ["npm", "run", "dev"]