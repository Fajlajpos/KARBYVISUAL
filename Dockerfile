# Použijeme oficiální stabilní Node.js image
FROM node:20-slim

# Instalace potřebných Linux build závislostí pro kompilaci sqlite3, bcrypt a sharp
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Pracovní adresář uvnitř kontejneru
WORKDIR /usr/src/app

# Zkopírování definic závislostí
COPY package*.json ./

# Instalace všech závislostí a jejich kompilace pro Linux prostředí
RUN npm install

# Zkopírování zbytku aplikace
COPY . .

# Výchozí port aplikace
EXPOSE 3001

# Spuštění serveru
CMD ["npm", "start"]
