import io

import matplotlib.pyplot as plt
import pandas as pd
import streamlit as st
import koreanize_matplotlib  # noqa: F401


LEVELS = ['A', 'B', 'C', 'D', 'E']
COLORS = {'A': '#d62728', 'B': '#ff7f0e', 'C': '#2ca02c',
          'D': '#1f77b4', 'E': '#9467bd'}
CHOICES = [1, 2, 3, 4, 5]


def classify(score):
    if pd.isna(score):
        return None
    for level, cut in [('A', 90), ('B', 80), ('C', 70), ('D', 60)]:
        if score >= cut:
            return level
    return 'E'


def number(value):
    return pd.to_numeric(str(value).strip(), errors='coerce')


def read_sheet(raw):
    # 각 파일의 머리글을 따로 찾아 반복 머리글이 학생으로 섞이지 않게 한다.
    header_row = None
    for index, row in raw.iterrows():
        if row.map(lambda x: str(x).strip()).eq('과목총점').any():
            header_row = index
            break
    if header_row is None:
        raise ValueError("'과목총점' 열을 찾을 수 없습니다.")
    if header_row + 3 > len(raw):
        raise ValueError('문항번호·정답·학생 데이터의 행 구성을 확인해 주세요.')

    header = raw.iloc[header_row].map(lambda x: str(x).strip())
    score_col = header[header.eq('과목총점')].index[0]
    answers = {}
    question_cols = {}
    for col in range(3, raw.shape[1]):
        q = number(raw.iloc[header_row, col])
        answer = number(raw.iloc[header_row + 1, col])
        if pd.notna(q) and float(q).is_integer() and answer in CHOICES:
            q = int(q)
            if q in answers:
                raise ValueError(f'문항번호 {q}가 중복되었습니다.')
            answers[q] = int(answer)
            question_cols[q] = col
    if not answers:
        raise ValueError('객관식 문항번호와 정답(1~5)을 찾을 수 없습니다.')

    # 기존 나이스 양식: 머리글, 정답, 배점 다음 행부터 학생 자료.
    body = raw.iloc[header_row + 3:].copy()
    scores = pd.to_numeric(body.iloc[:, score_col], errors='coerce')
    ids = body.iloc[:, 1]
    valid = ids.notna() & scores.notna()
    students = pd.DataFrame({'반/번호': ids[valid], '과목총점': scores[valid]})
    if not students['과목총점'].between(0, 100).all():
        raise ValueError('과목총점이 0~100점 범위를 벗어납니다. 100점 만점 자료를 사용해 주세요.')
    for q, col in question_cols.items():
        values = body.loc[valid, body.columns[col]]
        # 나이스에서 '.'은 정답 선택을 뜻한다. 그 외 무응답은 결측으로 보관한다.
        students[q] = values.map(
            lambda x: answers[q] if str(x).strip() == '.' else number(x)
        )
    students['성취수준'] = students['과목총점'].map(classify)
    return students.reset_index(drop=True), answers


def choice_ratios(frame, q):
    # 무응답·범위 밖 응답도 학생 수에 포함하여 정답률이 부풀지 않게 한다.
    if frame.empty:
        return pd.Series(float('nan'), index=CHOICES)
    return frame[q].value_counts().reindex(CHOICES, fill_value=0) / len(frame) * 100


st.set_page_config(page_title='평가분석', layout='wide')
st.title('📊 평가분석')
st.caption('과목총점 100점 기준 | A ≥ 90 · B ≥ 80 · C ≥ 70 · D ≥ 60 · E < 60')
st.info('업로드한 지필평가의 과목총점으로 분석용 집단을 구분합니다. '
        '학기말 성취도는 수행평가 등 반영 결과에 따라 달라질 수 있습니다.')
with st.expander('사용 안내'):
    st.markdown('나이스 **교과목별학생답정오표**를 같은 과목·같은 시험의 학급별로 함께 업로드하세요. '
                '총점 열 이름은 **과목총점**을 사용합니다. '
                '무응답은 오답으로 집계하며, 학생이 없는 수준은 정답률을 표시하지 않습니다. '
                '기존 상·하위 27% 변별도는 성취수준별 정답률로 대체했습니다.')

uploads = st.file_uploader('엑셀 파일 업로드 (여러 개 가능)',
                           type=['xlsx', 'xls'], accept_multiple_files=True)
if uploads:
    frames = []
    answer_map = None
    for upload in uploads:
        try:
            frame, answers = read_sheet(pd.read_excel(io.BytesIO(upload.getvalue()), header=None))
            if answer_map is not None and answers != answer_map:
                raise ValueError('다른 파일과 문항번호 또는 정답이 다릅니다. 같은 시험인지 확인해 주세요.')
            answer_map = answers
            frame.insert(0, '파일', upload.name)
            frames.append(frame)
        except Exception as exc:
            st.error(f'{upload.name}: {exc}')
            st.stop()
    data = pd.concat(frames, ignore_index=True)
    if data.empty:
        st.error('분석할 학생 자료가 없습니다. 반/번호와 과목총점을 확인해 주세요.')
        st.stop()

    counts = data['성취수준'].value_counts().reindex(LEVELS, fill_value=0)
    summary = pd.DataFrame({'성취수준': LEVELS,
                            '점수 구간': ['90 이상', '80 이상 90 미만', '70 이상 80 미만',
                                      '60 이상 70 미만', '60 미만'],
                            '학생 수': counts.values})
    summary['비율(%)'] = (summary['학생 수'] / len(data) * 100).round(1)
    st.subheader('성취수준별 인원')
    st.dataframe(summary, hide_index=True, use_container_width=True)

    ordered = data.sort_values('과목총점').reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(11, 5))
    ax.scatter(range(1, len(ordered) + 1), ordered['과목총점'],
               c=ordered['성취수준'].map(COLORS))
    for level, cut in [('A', 90), ('B', 80), ('C', 70), ('D', 60)]:
        ax.axhline(cut, color=COLORS[level], linestyle='--', label=f'{level} 기준 {cut}점')
    ax.set(title='과목총점 분포와 고정분할점수', xlabel='학생(과목총점 오름차순)',
           ylabel='과목총점', ylim=(-2, 105))
    ax.legend()
    ax.grid(alpha=0.25)
    st.pyplot(fig)
    plt.close(fig)

    st.subheader('문항별 정답률 및 보기 선택 비율')
    results = []
    for q, answer in answer_map.items():
        groups = {level: data[data['성취수준'].eq(level)] for level in LEVELS}
        ratios = {level: choice_ratios(groups[level], q) for level in LEVELS}
        total = choice_ratios(data, q)
        result = {'문항': q, '정답': answer, '전체 정답률(%)': total[answer]}
        for level in LEVELS:
            result[f'{level} 정답률(%)'] = ratios[level][answer]
        results.append(result)

        fig = plt.figure(figsize=(16, 9), constrained_layout=True)
        grid = fig.add_gridspec(3, 4)
        fig.suptitle(f'문항 {q} · 정답 {answer}번 · 전체 정답률 {total[answer]:.1f}%', fontsize=16)
        main = fig.add_subplot(grid[:, :2])
        for choice in CHOICES:
            main.plot(LEVELS, [ratios[level][choice] for level in LEVELS], marker='o',
                      label=f'{choice}번' + (' (정답)' if choice == answer else ''),
                      color='goldenrod' if choice == answer else None,
                      linewidth=3.5 if choice == answer else 1.5)
        main.set(xlabel='성취수준', ylabel='보기 선택 비율 (%)', ylim=(0, 105))
        main.legend()
        main.grid(alpha=0.25)
        panels = [('전체', data, total)] + [(level, groups[level], ratios[level]) for level in LEVELS]
        for index, (label, frame, values) in enumerate(panels):
            ax = fig.add_subplot(grid[index // 2, 2 + index % 2])
            if frame.empty:
                ax.text(0.5, 0.5, '해당 학생 없음', ha='center', va='center', transform=ax.transAxes)
            else:
                ax.bar(CHOICES, values.values,
                       color=['gold' if c == answer else COLORS.get(label, 'gray') for c in CHOICES])
            ax.set(title=f'{label} ({len(frame)}명)', xticks=CHOICES, ylim=(0, 105))
        st.pyplot(fig)
        plt.close(fig)

    st.subheader('문항별 정답률 요약 (%)')
    result_df = pd.DataFrame(results).round(1)
    st.dataframe(result_df, hide_index=True, use_container_width=True)
    st.download_button('정답률 요약 CSV 다운로드', result_df.to_csv(index=False).encode('utf-8-sig'),
                       file_name='문항별_성취수준_정답률.csv', mime='text/csv')
