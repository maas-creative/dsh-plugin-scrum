FROM node:24-bookworm-slim@sha256:01d566e8d94d8c619591d78652babfccd3c6992a3dffa9ed5ab39e11cf6c70e9
RUN apt-get update && apt-get install -y --no-install-recommends bash git ripgrep python3 ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/dsh
COPY package.json /opt/dsh/scrum-package.json
RUN node -e 'const fs=require("fs"),scrum=require("./scrum-package.json");fs.writeFileSync("package.json",JSON.stringify({private:true,dependencies:{...scrum.dependencies,...Object.fromEntries(Object.entries(scrum.peerDependencies).filter(([name])=>name.startsWith("@deepseek-ai/"))),"@deepseek-ai/dsh":"0.2.2-rc.1"}}))' && npm install --omit=dev --no-audit --no-fund
COPY docker-worker-policy.mjs /opt/dsh/worker-policy.mjs
ENV DSH_HOME=/state
USER node
ENTRYPOINT ["node","/opt/dsh/node_modules/@deepseek-ai/dsh/lib/bin.js","--profile","sdk","--patch","/config/worker.json"]
