let allChannels = [];
        let favorites = JSON.parse(localStorage.getItem('iptv_favorites') || '[]');
        let recentChannels = JSON.parse(localStorage.getItem('iptv_recent') || '[]');
        let savedPlaylists = JSON.parse(localStorage.getItem('iptv_saved_playlists') || '{}');
        
        let currentView = 'all';
        let selectedCategory = 'all';
        const video = document.getElementById('video-player');
        let hls;

        function updateSavedPlaylistsUI() {
            const select = document.getElementById('saved-playlists-select');
            select.innerHTML = '<option value="">-- اختر قائمة محفوظة --</option>';
            for (let name in savedPlaylists) {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                select.appendChild(opt);
            }
        }
        updateSavedPlaylistsUI();

        document.getElementById('saved-playlists-select').addEventListener('change', (e) => {
            const name = e.target.value;
            if (name && savedPlaylists[name]) {
                document.getElementById('playlist-url').value = savedPlaylists[name];
                loadPlaylist(savedPlaylists[name]);
            }
        });

        document.getElementById('share-btn').addEventListener('click', async () => {
            if (navigator.share) {
                try {
                    await navigator.share({
                        title: 'مشغل IPTV الاحترافي',
                        text: 'جرب تطبيق مشغل الـ IPTV الاحترافي المتطور!',
                        url: window.location.href
                    });
                } catch (err) { console.log(err); }
            } else {
                navigator.clipboard.writeText(window.location.href);
                alert('تم نسخ رابط التطبيق للحافظة!');
            }
        });

        document.getElementById('aspect-ratio-select').addEventListener('change', (e) => {
            video.style.objectFit = e.target.value;
        });

        document.getElementById('pip-btn').addEventListener('click', async () => {
            try {
                if (document.pictureInPictureElement) {
                    await document.exitPictureInPicture();
                } else if (document.pictureInPictureEnabled) {
                    await video.requestPictureInPicture();
                } else {
                    alert('ميزة الصورة داخل الصورة غير مدعومة في متصفحك');
                }
            } catch (err) { console.log(err); }
        });

        // تشغيل عبر الرابط
        document.getElementById('load-playlist-btn').addEventListener('click', async () => {
            const url = document.getElementById('playlist-url').value.trim();
            if (!url) {
                alert('الرجاء إدخال رابط صالح');
                return;
            }
            const playlistName = prompt('أدخل اسمًا لهذه القائمة لحفظها:', 'قائمة ' + Date.now().toString().slice(-4));
            if (playlistName) {
                savedPlaylists[playlistName] = url;
                localStorage.setItem('iptv_saved_playlists', JSON.stringify(savedPlaylists));
                updateSavedPlaylistsUI();
                document.getElementById('saved-playlists-select').value = playlistName;
            }
            loadPlaylist(url);
        });

        // تشغيل عبر رفع الملف محلياً
        document.getElementById('load-file-btn').addEventListener('click', () => {
            const fileInput = document.getElementById('playlist-file');
            if (fileInput.files.length === 0) {
                alert('الرجاء اختيار ملف M3U أو M3U8 من جهازك أولاً');
                return;
            }

            const file = fileInput.files[0];
            const reader = new FileReader();
            
            reader.onload = function(e) {
                processPlaylistData(e.target.result);
                const playlistName = `ملف محلي: ${file.name}`;
                savedPlaylists[playlistName] = 'local_file';
                localStorage.setItem('iptv_saved_playlists', JSON.stringify(savedPlaylists));
                updateSavedPlaylistsUI();
            };
            
            reader.onerror = function() {
                alert('حدث خطأ أثناء قراءة الملف');
            };

            reader.readAsText(file);
        });

        document.getElementById('delete-playlist-btn').addEventListener('click', () => {
            const select = document.getElementById('saved-playlists-select');
            const name = select.value;
            if (name && savedPlaylists[name]) {
                delete savedPlaylists[name];
                localStorage.setItem('iptv_saved_playlists', JSON.stringify(savedPlaylists));
                updateSavedPlaylistsUI();
                alert('تم حذف القائمة بنجاح');
            } else {
                alert('الرجاء اختيار قائمة محفوظة لحذفها');
            }
        });

        async function loadPlaylist(url) {
            const corsProxy = 'https://api.allorigins.win/raw?url=';
            try {
                const btn = document.getElementById('load-playlist-btn');
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري التحميل...';
                btn.disabled = true;

                const response = await fetch(corsProxy + encodeURIComponent(url));
                if (!response.ok) throw new Error('فشل جلب الملف');
                const data = await response.text();
                
                processPlaylistData(data);
            } catch (error) {
                alert('حدث خطأ في تحميل القائمة عبر الرابط. نوصي باستخدام خيار "رفع ملف M3U من الجهاز".');
                console.error(error);
            } finally {
                const btn = document.getElementById('load-playlist-btn');
                btn.innerHTML = '<i class="fa-solid fa-play me-2"></i> تشغيل وحفظ';
                btn.disabled = false;
            }
        }

        function processPlaylistData(data) {
            allChannels = parseM3U(data);
            populateCategories(allChannels);
            renderChannels();
            document.getElementById('channels-count').textContent = `${allChannels.length} قناة`;
            
            if (allChannels.length > 0) {
                playChannel(allChannels[0].url, allChannels[0].name, allChannels[0].logo);
            } else {
                alert('لم يتم العثور على قنوات صالحة في الملف.');
            }
        }

        function parseM3U(data) {
            const lines = data.split('\n');
            const channels = [];
            let currentChannel = {};

            for (let i = 0; i < lines.length; i++) {
                let line = lines[i].trim();
                if (line.startsWith('#EXTINF:')) {
                    currentChannel = {};
                    const logoMatch = line.match(/tvg-logo="([^"]*)"/);
                    currentChannel.logo = logoMatch ? logoMatch[1] : 'https://via.placeholder.com/35?text=TV';

                    const groupMatch = line.match(/group-title="([^"]*)"/);
                    currentChannel.group = groupMatch ? groupMatch[1] : 'عام';

                    const commaIndex = line.lastIndexOf(',');
                    if (commaIndex !== -1) {
                        currentChannel.name = line.substring(commaIndex + 1).trim();
                    }
                } else if (line && !line.startsWith('#')) {
                    currentChannel.url = line;
                    if (currentChannel.name && currentChannel.url) {
                        channels.push(currentChannel);
                    }
                }
            }
            return channels;
        }

        function populateCategories(channels) {
            const select = document.getElementById('category-select');
            select.innerHTML = '<option value="all">جميع الأقسام</option>';
            const groups = [...new Set(channels.map(ch => ch.group))];
            groups.sort().forEach(group => {
                const opt = document.createElement('option');
                opt.value = group;
                opt.textContent = group;
                select.appendChild(opt);
            });
        }

        function switchView(view) {
            currentView = view;
            document.getElementById('tab-all').classList.toggle('active', view === 'all');
            document.getElementById('tab-fav').classList.toggle('active', view === 'fav');
            document.getElementById('tab-recent').classList.toggle('active', view === 'recent');
            document.getElementById('category-filter-container').style.display = view === 'all' ? 'block' : 'none';
            renderChannels();
        }

        function renderChannels() {
            const listContainer = document.getElementById('channels-list');
            listContainer.innerHTML = '';

            let targetList = [];
            if (currentView === 'all') targetList = allChannels;
            else if (currentView === 'fav') targetList = favorites;
            else if (currentView === 'recent') targetList = recentChannels;

            const searchQuery = document.getElementById('search-channels').value.toLowerCase();

            if (currentView === 'all' && selectedCategory !== 'all') {
                targetList = targetList.filter(ch => ch.group === selectedCategory);
            }

            if (searchQuery) {
                targetList = targetList.filter(ch => ch.name.toLowerCase().includes(searchQuery));
            }

            if (targetList.length === 0) {
                listContainer.innerHTML = '<div class="text-center text-white-50 py-5">لا توجد قنوات مطابقة</div>';
                return;
            }

            const fragment = document.createDocumentFragment();
            const renderLimit = Math.min(targetList.length, 300);

            for (let i = 0; i < renderLimit; i++) {
                const channel = targetList[i];
                const isFav = favorites.some(fav => fav.url === channel.url);
                
                const item = document.createElement('div');
                item.className = 'channel-item';
                item.innerHTML = `
                    <img src="${channel.logo}" class="channel-logo" onerror="this.src='https://via.placeholder.com/35?text=TV'">
                    <span class="channel-name" title="${channel.name}">${channel.name}</span>
                    <button class="fav-btn" title="إضافة/إزالة من المفضلة"><i class="${isFav ? 'fa-solid' : 'fa-regular'} fa-star"></i></button>
                `;

                item.querySelector('.channel-name').addEventListener('click', () => {
                    document.querySelectorAll('.channel-item').forEach(el => el.classList.remove('active'));
                    item.classList.add('active');
                    playChannel(channel.url, channel.name, channel.logo);
                });
                item.querySelector('img').addEventListener('click', () => {
                    playChannel(channel.url, channel.name, channel.logo);
                });

                item.querySelector('.fav-btn').addEventListener('click', (e) => {
                    e.stopPropagation();
                    toggleFavorite(channel);
                });

                fragment.appendChild(item);
            }
            listContainer.appendChild(fragment);
        }

        function toggleFavorite(channel) {
            const index = favorites.findIndex(fav => fav.url === channel.url);
            if (index > -1) {
                favorites.splice(index, 1);
            } else {
                favorites.push(channel);
            }
            localStorage.setItem('iptv_favorites', JSON.stringify(favorites));
            renderChannels();
        }

        function playChannel(url, name, logo) {
            document.getElementById('current-channel-title').textContent = `يعرض الآن: ${name}`;
            document.getElementById('epg-info').textContent = 'دليل البرامج: بث مباشر عام';

            const channelObj = { name, url, logo };
            recentChannels = recentChannels.filter(ch => ch.url !== url);
            recentChannels.unshift(channelObj);
            if (recentChannels.length > 15) recentChannels.pop();
            localStorage.setItem('iptv_recent', JSON.stringify(recentChannels));

            if (Hls.isSupported() && url.includes('.m3u8')) {
                if (hls) hls.destroy();
                hls = new Hls();
                hls.loadSource(url);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    video.play().catch(e => console.log(e));
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                video.src = url;
                video.addEventListener('loadedmetadata', () => {
                    video.play().catch(e => console.log(e));
                });
            } else {
                video.src = url;
                video.play().catch(e => console.log(e));
            }
        }

        document.getElementById('search-channels').addEventListener('input', () => renderChannels());
        document.getElementById('category-select').addEventListener('change', (e) => {
            selectedCategory = e.target.value;
            renderChannels();
        });

        let deferredPrompt;
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            document.getElementById('install-pwa-btn').style.display = 'inline-block';
        });

        document.getElementById('install-pwa-btn').addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === 'accepted') {
                    document.getElementById('install-pwa-btn').style.display = 'none';
                }
                deferredPrompt = null;
            }
        });