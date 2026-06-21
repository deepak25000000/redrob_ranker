FROM node:20 AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install fastapi uvicorn python-multipart
COPY src/ ./src/
COPY rank.py validate_submission.py api.py ./
COPY sample_data/ ./sample_data/
COPY --from=frontend-build /app/frontend/dist /app/frontend/dist

# Expose FastAPI on 8000
EXPOSE 8000

# Run Uvicorn
CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000"]
