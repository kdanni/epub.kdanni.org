document.addEventListener('DOMContentLoaded', () => {
    const uploadForm = document.getElementById('upload-form');
    const epubList = document.getElementById('epub-list');
    const readerSection = document.getElementById('reader-section');
    const bookTitle = document.getElementById('book-title');
    const bookMetadata = document.getElementById('book-metadata');
    const chapterNav = document.getElementById('chapter-nav');
    const chapterContent = document.getElementById('chapter-content');

    function fetchLibrary() {
        fetch('/api/epubs')
            .then(res => res.json())
            .then(data => {
                epubList.innerHTML = '';
                data.forEach(epub => {
                    const li = document.createElement('li');
                    li.textContent = epub.title || epub.filename;
                    li.onclick = () => openBook(epub.id);
                    epubList.appendChild(li);
                });
            });
    }

    function openBook(id) {
        fetch(`/api/epub/${id}/metadata`)
            .then(res => res.json())
            .then(meta => {
                bookTitle.textContent = meta.title;
                bookMetadata.innerHTML = `<strong>Author:</strong> ${meta.author || ''}`;
                fetch(`/api/epub/${id}/chapters`)
                    .then(res => res.json())
                    .then(chapters => {
                        chapterNav.innerHTML = '';
                        chapters.forEach((ch, idx) => {
                            const btn = document.createElement('button');
                            btn.textContent = ch.label || `Chapter ${idx+1}`;
                            btn.onclick = () => loadChapter(id, ch.id, btn);
                            chapterNav.appendChild(btn);
                        });
                        if (chapters.length) {
                            loadChapter(id, chapters[0].id, chapterNav.querySelector('button'));
                        }
                        readerSection.style.display = '';
                    });
            });
    }

    function loadChapter(bookId, chapterId, btn) {
        Array.from(chapterNav.children).forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetch(`/api/epub/${bookId}/chapter/${chapterId}`)
            .then(res => res.text())
            .then(html => {
                chapterContent.innerHTML = html;
            });
    }

    uploadForm.onsubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(uploadForm);
        fetch('/api/upload', {
            method: 'POST',
            body: formData
        })
        .then(res => res.json())
        .then(() => {
            fetchLibrary();
            uploadForm.reset();
        });
    };

    fetchLibrary();
});
