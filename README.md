# 평가분석

나이스 교과목별학생답정오표를 업로드하여 문항별 보기 선택 비율과 성취수준별 정답률을 확인하는 Streamlit 앱입니다.

## 분석 기준

100점 만점의 `과목총점` 열을 사용합니다.

| 수준 | 점수 |
|---|---|
| A | 90 이상 |
| B | 80 이상 90 미만 |
| C | 70 이상 80 미만 |
| D | 60 이상 70 미만 |
| E | 60 미만 |

업로드한 시험 점수 기준의 분석용 구분이며 수행평가 등을 합산한 학기말 성취도와 다를 수 있습니다. 같은 과목·같은 시험의 학급별 파일을 함께 업로드하세요. 학생 자료는 저장소에 올리지 마세요.

## 로컬 실행

```sh
pip install -r requirements.txt
streamlit run main.py
```

## Streamlit Community Cloud 배포

1. 이 파일들과 `main.py`, `requirements.txt`를 GitHub 저장소에 올립니다.
2. Streamlit Community Cloud에서 GitHub 계정을 연결하고 새 앱을 만듭니다.
3. 저장소와 `main` 브랜치를 선택하고 실행 파일을 `main.py`로 지정합니다.
4. 배포를 실행합니다.

## 원본

[Yoon-JinSeok/itemanalysis](https://github.com/yoon-jinseok/itemanalysis)의 프로그램을 참고하여 고정분할점수 기준으로 수정했습니다.
