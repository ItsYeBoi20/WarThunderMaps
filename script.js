class WarThunderMaps {
    constructor() {
        this.maps = []; // This will hold the MANIFEST of maps
        this.currentMap = null; // This will hold the FULL data of the loaded map
        this.dirtyMaps = new Map(); // Cache for modified maps, keyed by map.id
        
        // State for editing
        this.editingAnnotationId = null;
        this.editingMapId = null;
        this.selectedLine = null;

        this.annotationPosition = null;
        this.scale = 1;
        this.panPosition = { x: 0, y: 0 };
        this.isPanning = false;
        this.dragJustFinished = false;
        this.dragStartPoint = { x: 0, y: 0 };
        this.lastPanPoint = { x: 0, y: 0 };
        this.isDrawingLine = false;
        this.lineStartPoint = null;
        this.lineColor = '#ff6b6b';

        this.boundMouseMove = this.handleMouseMove.bind(this);
        this.boundMouseUp = this.handleMouseUp.bind(this);

        this.initializeElements();
        this.bindEvents();

        (async () => {
            this.maps = await this.loadMaps();
            this.renderMaps();
        })();
    }

    initializeElements() {
        // Main page
        this.searchInput = document.getElementById('searchInput');
        this.clearSearchBtn = document.getElementById('clearSearch');
        this.mapsGrid = document.getElementById('mapsGrid');
        this.addMapBtn = document.getElementById('addMapBtn');
        this.exportAllBtn = document.getElementById('exportAllBtn');
        this.importBtn = document.getElementById('importBtn');
        this.importFile = document.getElementById('importFile');
        this.changeMapImageFile = document.getElementById('changeMapImageFile');

        // Map Modal
        this.mapModal = document.getElementById('mapModal');
        this.modalTitle = document.getElementById('modalTitle');
        this.mapImage = document.getElementById('mapImage');
        this.annotationsLayer = document.getElementById('annotationsLayer');
        this.linesLayer = document.getElementById('linesLayer');
        this.mapWrapper = document.getElementById('mapWrapper');
        this.mapContainer = document.getElementById('mapContainer');
        this.exportMapBtn = document.getElementById('exportMapBtn');
        this.deleteMapBtn = document.getElementById('deleteMapBtn');
        this.drawLineBtn = document.getElementById('drawLineBtn');
        this.colorPicker = document.getElementById('colorPicker');
        this.colorOptions = document.getElementById('colorOptions');
        this.colorOptionElements = document.querySelectorAll('.color-option');
        
        // Add/Edit Map Modal
        this.addMapModal = document.getElementById('addMapModal');
        this.addMapModalTitle = document.getElementById('addMapModalTitle');
        this.addMapForm = document.getElementById('addMapForm');
        this.mapNameInput = document.getElementById('mapName');
        this.mapImageInput = document.getElementById('mapImageFile');

        // Add/Edit Annotation Modal
        this.annotationModal = document.getElementById('annotationModal');
        this.annotationModalTitle = document.getElementById('annotationModalTitle');
        this.annotationForm = document.getElementById('annotationForm');
        this.annotationLabelInput = document.getElementById('annotationLabel');
        this.annotationTypeInput = document.getElementById('annotationType');
        this.annotationImageInput = document.getElementById('annotationImageFile');
        this.annotationNotesInput = document.getElementById('annotationNotes');
        this.annotationSubmitBtn = document.getElementById('annotationSubmitBtn');
        
        // Annotation Detail Modal
        this.annotationDetailModal = document.getElementById('annotationDetailModal');
        this.annotationDetailTitle = document.getElementById('annotationDetailTitle');
        this.annotationDetailImage = document.getElementById('annotationDetailImage');
        this.annotationDetailNotes = document.getElementById('annotationDetailNotes');
        this.editAnnotationBtn = document.getElementById('editAnnotationBtn');

        // Image Preview
        this.imagePreviewModal = document.getElementById('imagePreviewModal');
        this.previewImage = document.getElementById('previewImage');
        this.closePreviewModal = document.getElementById('closePreviewModal');
    }

    bindEvents() {
        this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.clearSearchBtn.addEventListener('click', () => this.clearSearch());
        this.addMapBtn.addEventListener('click', () => this.showAddMapModal());
        this.exportAllBtn.addEventListener('click', () => this.exportAllAsZip());
        this.importBtn.addEventListener('click', () => alert("Import is now handled by extracting an exported ZIP file and refreshing the page."));
        this.changeMapImageFile.addEventListener('change', (e) => this.handleMapImageChange(e));

        // Modals
        document.getElementById('closeAddModal').addEventListener('click', () => this.hideAddMapModal());
        this.addMapForm.addEventListener('submit', (e) => this.handleAddMap(e));
        document.getElementById('closeModal').addEventListener('click', () => this.hideMapModal());
        document.getElementById('closeAnnotationModal').addEventListener('click', () => this.hideAnnotationModal());
        this.annotationForm.addEventListener('submit', (e) => this.handleAnnotationFormSubmit(e));
        document.getElementById('closeAnnotationDetailModal').addEventListener('click', () => this.hideAnnotationDetailModal());
        this.editAnnotationBtn.addEventListener('click', () => this.showEditAnnotationModal());
        this.closePreviewModal.addEventListener('click', () => this.hideImagePreviewModal());
        this.imagePreviewModal.addEventListener('click', (e) => { if (e.target === this.imagePreviewModal) this.hideImagePreviewModal(); });
        this.annotationDetailImage.addEventListener('click', () => {
            if (this.annotationDetailImage.style.display !== 'none' && this.annotationDetailImage.src) {
                this.showImagePreviewModal(this.annotationDetailImage.src);
            }
        });

        // Map controls
        this.exportMapBtn.addEventListener('click', () => this.exportCurrentMapAsZip());
        this.deleteMapBtn.addEventListener('click', () => this.deleteCurrentMap());
        this.drawLineBtn.addEventListener('click', () => this.toggleLineDrawing());
        this.colorPicker.addEventListener('click', () => this.toggleColorPicker());
        this.colorOptionElements.forEach(option => option.addEventListener('click', (e) => this.selectColor(e.target.dataset.color, e)));

        // Map interactions
        this.mapWrapper.addEventListener('wheel', (e) => this.handleZoom(e));
        this.mapWrapper.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.mapWrapper.addEventListener('click', (e) => this.handleMapClick(e));

        // Global listeners
        const modals = [this.addMapModal, this.annotationModal, this.annotationDetailModal, this.mapModal];
        modals.forEach(modal => { if (modal) modal.addEventListener('click', e => { if (!this.dragJustFinished && e.target === modal) this.closeTopModal(); }); });
        window.addEventListener('mousedown', e => { this.dragJustFinished = false; this.dragStartPoint = { x: e.clientX, y: e.clientY }; }, true);
        window.addEventListener('mousemove', e => { if (this.dragStartPoint && !this.dragJustFinished) { if (Math.sqrt(Math.pow(e.clientX - this.dragStartPoint.x, 2) + Math.pow(e.clientY - this.dragStartPoint.y, 2)) > 5) this.dragJustFinished = true; } }, true);
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('resize', () => { if (this.mapModal.classList.contains('visible')) this.resetMapDimensions(); });
        document.addEventListener('mousedown', (e) => { if (this.colorOptions.classList.contains('visible') && !this.colorPicker.parentElement.contains(e.target)) this.colorOptions.classList.remove('visible'); });
    }

    async loadMaps() { try { const r = await fetch(`maps.json?v=${Date.now()}`); if (!r.ok) { if (r.status === 404) return []; throw new Error(`HTTP error! status: ${r.status}`); } return await r.json(); } catch (e) { console.error('Error loading map manifest:', e); this.mapsGrid.innerHTML = `<div class="empty-state"><h3>Could not load maps.json</h3><p>${e.message}</p></div>`; return []; } }
    handleSearch(q) { this.renderMaps(this.maps.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))); this.clearSearchBtn.classList.toggle('visible', q.length > 0); }
    clearSearch() { this.searchInput.value = ''; this.renderMaps(); this.clearSearchBtn.classList.remove('visible'); }
    renderMaps(mapsToRender = this.maps) { this.mapsGrid.innerHTML = ''; if (mapsToRender.length === 0) { this.mapsGrid.innerHTML = `<div class="empty-state"><h3>No maps found</h3><p>Add a map or extract an exported zip file.</p></div>`; return; } mapsToRender.forEach(m => { this.mapsGrid.appendChild(this.createMapCard(m)); }); }

    createMapCard(map) {
        const card = document.createElement('div');
        card.className = 'map-card';
        let imageUrl;
        if (map.isNew) imageUrl = map.imageUrl;
        else if (map.image) imageUrl = `maps/${map.image}`;
        else imageUrl = `maps/${map.path}/map.jpg`;
        card.innerHTML = `<img class="map-card-image" src="${imageUrl}" alt="${map.name}"><div class="map-card-content"><div class="map-card-title">${map.name}</div></div>`;
        card.addEventListener('click', () => this.showMapModal(map));
        card.addEventListener('contextmenu', e => {
            e.preventDefault();
            if (confirm(`Change image for "${map.name}"?`)) {
                this.editingMapId = map.id;
                this.changeMapImageFile.click();
            }
        });
        return card;
    }

    async showMapModal(mapFromManifest) { try { let mapData; if (this.dirtyMaps.has(mapFromManifest.id)) mapData = this.dirtyMaps.get(mapFromManifest.id); else if (mapFromManifest.isNew) mapData = mapFromManifest; else { const r = await fetch(`maps/${mapFromManifest.path}/data.json?v=${Date.now()}`); if (!r.ok) throw new Error(`Could not load map data for ${mapFromManifest.name}`); mapData = await r.json(); } this.currentMap = mapData; this.modalTitle.textContent = this.currentMap.name; this.mapImage.src = mapData.isNew ? mapData.imageUrl : `maps/${mapData.image}`; this.scale = 1; this.panPosition = { x: 0, y: 0 }; this.annotationsLayer.innerHTML = ''; this.linesLayer.innerHTML = ''; this.exitLineDrawingMode(); this.colorPicker.style.backgroundColor = this.lineColor; this.mapModal.classList.add('visible'); const setup = () => this.resetMapDimensions(); if (this.mapImage.complete) setup(); else this.mapImage.onload = setup; } catch (e) { alert(`Error: ${e.message}`); console.error(e); } }
    hideMapModal() { this.hideModalWithAnimation(this.mapModal, () => { if (this.currentMap) { if (this.currentMap.isDirty) { this.dirtyMaps.set(this.currentMap.id, this.currentMap); } this.currentMap = null; } this.exitLineDrawingMode(); }); }
    showAddMapModal() { this.addMapForm.reset(); this.addMapModal.classList.add('visible'); }
    hideAddMapModal() { this.hideModalWithAnimation(this.addMapModal); }
    hideAnnotationModal() { this.hideModalWithAnimation(this.annotationModal, () => { this.editingAnnotationId = null; }); }
    
    showAnnotationModal(position) {
        this.editingAnnotationId = null;
        this.annotationModalTitle.textContent = 'Add Annotation';
        this.annotationSubmitBtn.textContent = 'Add Annotation';
        this.annotationForm.reset();
        this.annotationPosition = position;
        this.annotationModal.classList.add('visible');
    }

    showEditAnnotationModal() {
        if (!this.currentAnnotation) return;
        const annotation = this.currentAnnotation;
        this.hideAnnotationDetailModal();
        
        this.editingAnnotationId = annotation.id;
        this.annotationModalTitle.textContent = 'Edit Annotation';
        this.annotationSubmitBtn.textContent = 'Save Changes';
        this.annotationForm.reset();

        this.annotationLabelInput.value = annotation.label;
        this.annotationTypeInput.value = annotation.type;
        this.annotationNotesInput.value = annotation.notes || '';
        
        this.annotationModal.classList.add('visible');
    }
    
    showAnnotationDetailModal(annotation) {
        this.currentAnnotation = annotation; // Store for the edit button
        this.annotationDetailTitle.textContent = annotation.label;
        let imageUrl = null;
        if (annotation.imageFile) imageUrl = URL.createObjectURL(annotation.imageFile);
        else if (annotation.image) imageUrl = `maps/${annotation.image}`;
        if (imageUrl) { this.annotationDetailImage.src = imageUrl; this.annotationDetailImage.style.display = 'block'; } 
        else { this.annotationDetailImage.style.display = 'none'; }
        this.annotationDetailNotes.textContent = annotation.notes || '';
        this.annotationDetailNotes.style.display = annotation.notes ? 'block' : 'none';
        this.annotationDetailModal.classList.add('visible');
    }

    hideAnnotationDetailModal() { this.hideModalWithAnimation(this.annotationDetailModal, () => { const objUrl = this.annotationDetailImage.src; if (objUrl && objUrl.startsWith('blob:')) URL.revokeObjectURL(objUrl); this.currentAnnotation = null; }); }
    showImagePreviewModal(src) { this.previewImage.src = src; this.imagePreviewModal.classList.add('visible'); }
    hideImagePreviewModal() { this.hideModalWithAnimation(this.imagePreviewModal); }
    hideModalWithAnimation(el, cb = () => {}) { if (!el || !el.classList.contains('visible')) return; el.classList.add('closing'); const onEnd = () => { el.classList.remove('closing', 'visible'); el.removeEventListener('animationend', onEnd); cb(); }; el.addEventListener('animationend', onEnd); }
    closeTopModal() { if (this.imagePreviewModal.classList.contains('visible')) return this.hideImagePreviewModal(); if (this.annotationDetailModal.classList.contains('visible')) return this.hideAnnotationDetailModal(); if (this.annotationModal.classList.contains('visible')) return this.hideAnnotationModal(); if (this.addMapModal.classList.contains('visible')) return this.hideAddMapModal(); if (this.mapModal.classList.contains('visible')) return this.hideMapModal(); }
    markCurrentMapDirty() { if (this.currentMap) this.currentMap.isDirty = true; }

    handleAddMap(e) { e.preventDefault(); const name = this.mapNameInput.value; const imageFile = this.mapImageInput.files[0]; if (!name || !imageFile) return alert('Please provide a name and image file.'); const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`; const sanName = (name || '').replace(/[^a-zA-Z0-9-_]+/g, '').replace(/ /g, '-').toLowerCase(); const dirName = `${id}_${sanName}`; const imgExt = this.getFileExtension(imageFile.name); const imgFileName = `map.${imgExt}`; const newMap = { id, name, imageFile, imageUrl: URL.createObjectURL(imageFile), imageFilename: imageFile.name, annotations: [], lines: [], isNew: true, isDirty: true, path: dirName, image: `${dirName}/${imgFileName}` }; this.maps.push(newMap); this.dirtyMaps.set(id, newMap); this.hideModalWithAnimation(this.addMapModal, () => { this.renderMaps(); }); this.addMapForm.reset(); }
    
    handleAnnotationFormSubmit(e) {
        e.preventDefault();
        const label = this.annotationLabelInput.value;
        const type = this.annotationTypeInput.value;
        const notes = this.annotationNotesInput.value;
        const imageFile = this.annotationImageInput.files[0];

        if (this.editingAnnotationId) { // Editing existing annotation
            const annotation = this.currentMap.annotations.find(a => a.id === this.editingAnnotationId);
            if (annotation) {
                annotation.label = label;
                annotation.type = type;
                annotation.notes = notes;
                if (imageFile) {
                    annotation.imageFile = imageFile;
                    annotation.isNewImage = true;
                    annotation.image = null; // Invalidate old path
                }
            }
        } else { // Adding new annotation
            const annotation = { id: `${Date.now()}`, label, type, notes, position: this.annotationPosition, image: null, imageFile: null, isNewImage: !!imageFile };
            if (imageFile) annotation.imageFile = imageFile;
            this.currentMap.annotations.push(annotation);
        }
        this.markCurrentMapDirty();
        this.renderAnnotations();
        this.hideAnnotationModal();
    }

    renderAnnotations() { if (!this.currentMap || !this.mapImage.complete || !this.mapImage.naturalWidth) return; this.annotationsLayer.innerHTML = ""; const w = this.mapImage.width, h = this.mapImage.height; if (w === 0 || h === 0) return; this.currentMap.annotations.forEach(ann => { const marker = document.createElement('div'); marker.className = `annotation-marker ${ann.type}`; marker.style.left = `${ann.position.x * w}px`; marker.style.top = `${ann.position.y * h}px`; marker.innerHTML = `<div class="annotation-tooltip"><strong>${ann.label}</strong></div>`; marker.addEventListener('click', (e) => { e.stopPropagation(); this.showAnnotationDetailModal(ann); }); marker.addEventListener('contextmenu', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (confirm('Delete annotation?')) this.deleteAnnotation(ann.id); }); this.annotationsLayer.appendChild(marker); }); }
    deleteAnnotation(id) { if (!this.currentMap) return; this.currentMap.annotations = this.currentMap.annotations.filter(a => a.id !== id); this.markCurrentMapDirty(); this.renderAnnotations(); }
    deleteLine(id) { if (!this.currentMap) return; this.currentMap.lines = this.currentMap.lines.filter(l => l.id !== id); this.markCurrentMapDirty(); this.renderLines(); }
    deleteCurrentMap() { if (!this.currentMap || !confirm(`Delete map "${this.currentMap.name}"?`)) return; this.maps = this.maps.filter(m => m.id !== this.currentMap.id); this.dirtyMaps.delete(this.currentMap.id); this.renderMaps(); this.hideMapModal(); }
    
    handleMapImageChange(e) {
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const map = this.maps.find(m => m.id === this.editingMapId);
        if (!map) return;

        map.isNew = true; // Treat it as a new map for export purposes
        map.imageFile = file;
        map.imageUrl = URL.createObjectURL(file);
        map.imageFilename = file.name;
        
        const imageExt = this.getFileExtension(file.name);
        map.image = `${map.path}/map.${imageExt}`;

        this.markCurrentMapDirty();
        this.dirtyMaps.set(map.id, map);
        this.renderMaps();
        this.editingMapId = null;
        e.target.value = ''; // Reset file input
    }
    
    async exportAllAsZip() { await this.exportZip(this.maps, this.maps, "WarThunderMaps_Export.zip"); this.dirtyMaps.clear(); alert('Export complete!'); }
    async exportCurrentMapAsZip() { if (!this.currentMap) return; const mapEntry = this.maps.find(m => m.id === this.currentMap.id); if (!mapEntry) return alert("Could not find map in main list."); this.markCurrentMapDirty(); this.dirtyMaps.set(this.currentMap.id, this.currentMap); const sanName = (this.currentMap.name || '').replace(/[^a-zA-Z0-9-_]+/g, '').replace(/ /g, '-').toLowerCase(); await this.exportZip([mapEntry], this.maps, `WarThunderMap_${sanName}.zip`); }
    async exportZip(mapsToProcess, allMapsForManifest, filename) { const zip = new JSZip(); const mapsFolder = zip.folder("maps"); const newManifest = []; for (const map of allMapsForManifest) { const mapData = this.dirtyMaps.get(map.id) || map; const sanName = (mapData.name || '').replace(/[^a-zA-Z0-9-_]+/g, '').replace(/ /g, '-').toLowerCase(); const dirName = `${mapData.id}_${sanName}`; let imagePath = mapData.image; if (mapData.isNew || !imagePath) { const imgExt = this.getFileExtension(mapData.imageFilename); imagePath = `${dirName}/map.${imgExt}`; } newManifest.push({ id: map.id, name: mapData.name, path: dirName, image: imagePath }); } zip.file("maps.json", JSON.stringify(newManifest, null, 2)); for (const map of mapsToProcess) { let mapData = this.dirtyMaps.get(map.id); if (!mapData) { const r = await fetch(`maps/${map.path}/data.json?v=${Date.now()}`); mapData = await r.json(); } const sanName = (mapData.name || '').replace(/[^a-zA-Z0-9-_]+/g, '').replace(/ /g, '-').toLowerCase(); const dirName = `${mapData.id}_${sanName}`; const currentFolder = mapsFolder.folder(dirName); const finalJson = { id: mapData.id, name: mapData.name, lines: mapData.lines || [], annotations: [] }; if (mapData.imageFile) { const imgExt = this.getFileExtension(mapData.imageFilename); const imgFileName = `map.${imgExt}`; currentFolder.file(imgFileName, mapData.imageFile); finalJson.image = `${dirName}/${imgFileName}`; } else { const r = await fetch(`maps/${mapData.image}`); currentFolder.file(mapData.image.split('/')[1], await r.blob()); finalJson.image = mapData.image; } for (const ann of mapData.annotations || []) { const newAnn = { ...ann, imageFile: undefined, isNewImage: undefined }; if (ann.isNewImage && ann.imageFile) { const annExt = this.getFileExtension(ann.imageFile.name); const annFileName = `annotation_${ann.id}.${annExt}`; currentFolder.file(annFileName, ann.imageFile); newAnn.image = `${dirName}/${annFileName}`; } else if (ann.image) { try { const r = await fetch(`maps/${ann.image}`); currentFolder.file(ann.image.split('/')[1], await r.blob()); } catch (e) { console.error(`Could not fetch annotation image ${ann.image}`, e); } } delete newAnn.imageFile; delete newAnn.isNewImage; delete newAnn.imageUrl; finalJson.annotations.push(newAnn); } currentFolder.file("data.json", JSON.stringify(finalJson, null, 2)); } const content = await zip.generateAsync({ type: "blob" }); saveAs(content, filename); }
    getFileExtension(filename = '') { return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase(); }
    resetMapDimensions() { if (!this.currentMap || !this.mapImage.complete || !this.mapImage.naturalWidth === 0) return; requestAnimationFrame(() => { const cRect = this.mapContainer.getBoundingClientRect(); if (cRect.height === 0) return; const iAR = this.mapImage.naturalWidth / this.mapImage.naturalHeight; const fH = Math.floor(cRect.height); const fW = Math.floor(fH * iAR); this.mapWrapper.style.width = `${fW}px`; [this.mapImage, this.annotationsLayer, this.linesLayer].forEach(el => { if (el) { el.style.width = `${fW}px`; el.style.height = `${fH}px`; } }); this.updateMapTransform(); this.renderAnnotations(); this.renderLines(); }); }
    
    toggleColorPicker(e) {
        if (e) {
            this.colorOptions.style.left = `${e.clientX}px`;
            this.colorOptions.style.top = `${e.clientY}px`;
        }
        this.colorOptions.classList.toggle('visible');
    }

    selectColor(color, event) {
        if (this.selectedLine) {
            this.selectedLine.color = color;
            this.markCurrentMapDirty();
            this.renderLines();
            this.selectedLine = null;
            this.colorOptions.classList.remove('visible');
            event.stopPropagation();
        } else {
            this.lineColor = color;
            this.colorPicker.style.backgroundColor = color;
        }
    }

    getNormalisedCursorPoint(e) { const rect = this.mapWrapper.getBoundingClientRect(); const localX = e.clientX - rect.left; const localY = e.clientY - rect.top; const clickX = (localX - this.panPosition.x) / this.scale; const clickY = (localY - this.panPosition.y) / this.scale; if (this.mapImage.width === 0 || this.mapImage.height === 0) return null; const nX = clickX / this.mapImage.width; const nY = clickY / this.mapImage.height; if (nX >= 0 && nX <= 1 && nY >= 0 && nY <= 1) { return { x: nX, y: nY, type: 'normalized' }; } return null; }
    handleMapClick(e) { if (this.dragJustFinished || this.isDrawingLine || e.target.closest('.annotation-marker') || e.target.closest('g')) return; e.preventDefault(); e.stopPropagation(); const point = this.getNormalisedCursorPoint(e); if (point) this.showAnnotationModal(point); }
    toggleLineDrawing() { if (this.isDrawingLine) this.exitLineDrawingMode(); else { this.isDrawingLine = true; this.drawLineBtn.classList.add('active'); this.mapWrapper.style.cursor = 'crosshair'; this.linesLayer.style.pointerEvents = 'auto'; } }
    exitLineDrawingMode() { this.isDrawingLine = false; this.lineStartPoint = null; if (this.drawLineBtn) this.drawLineBtn.classList.remove('active'); if (this.mapWrapper) this.mapWrapper.style.cursor = ''; if (this.linesLayer) { this.linesLayer.style.pointerEvents = 'none'; const preview = this.linesLayer.querySelector('#line-preview'); if (preview) preview.remove(); } }
    
    renderLines() {
        if (!this.currentMap || !this.mapImage.complete) return;
        const SVG_NS = "http://www.w3.org/2000/svg";
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#f9ca24', '#6c5ce7'];
        this.linesLayer.innerHTML = `<defs>${colors.map(c => `<marker id="arrow-${c.replace('#', '')}" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${c}"></path></marker>`).join('')}</defs>`;
        const w = this.mapImage.width, h = this.mapImage.height;
        if (w === 0) return;
        (this.currentMap.lines || []).forEach(line => {
            const group = document.createElementNS(SVG_NS, 'g');
            const hitbox = document.createElementNS(SVG_NS, 'line');
            const visual = document.createElementNS(SVG_NS, 'line');
            const setupLine = (el, l) => { el.setAttribute('x1', l.start.x * w); el.setAttribute('y1', l.start.y * h); el.setAttribute('x2', l.end.x * w); el.setAttribute('y2', l.end.y * h); };
            setupLine(hitbox, line);
            hitbox.setAttribute('stroke', 'transparent'); hitbox.setAttribute('stroke-width', '20'); hitbox.setAttribute('pointer-events', 'stroke'); hitbox.style.cursor = 'pointer';
            hitbox.addEventListener('contextmenu', e => { e.preventDefault(); if (confirm('Delete line?')) this.deleteLine(line.id); });
            hitbox.addEventListener('click', e => {
                e.stopPropagation();
                this.selectedLine = line;
                this.toggleColorPicker(e);
            });
            setupLine(visual, line);
            const lineColor = line.color || '#ff6b6b';
            visual.setAttribute('stroke', lineColor); visual.setAttribute('stroke-width', '3'); visual.setAttribute('marker-end', `url(#arrow-${lineColor.replace('#', '')})`); visual.setAttribute('pointer-events', 'none');
            group.appendChild(visual); group.appendChild(hitbox);
            this.linesLayer.appendChild(group);
        });
    }

    handleMouseDown(e) { if (e.button === 1) { e.preventDefault(); this.resetView(); return; } if (e.button !== 0) return; if (this.isDrawingLine) { this.lineStartPoint = this.getNormalisedCursorPoint(e); if (!this.lineStartPoint) return; const pLine = document.createElementNS('http://www.w3.org/2000/svg', 'line'); pLine.id = 'line-preview'; pLine.setAttribute('stroke', this.lineColor); pLine.setAttribute('stroke-dasharray', '4'); pLine.setAttribute('stroke-width', `calc(2 * var(--marker-scale, 1))`); this.linesLayer.appendChild(pLine); window.addEventListener('mousemove', this.boundMouseMove); window.addEventListener('mouseup', this.boundMouseUp); return; } if (e.target.closest('.annotation-marker')) return; e.preventDefault(); this.isPanning = true; this.lastPanPoint = { x: e.clientX, y: e.clientY }; this.mapWrapper.style.cursor = 'grabbing'; [this.mapImage, this.annotationsLayer, this.linesLayer].forEach(el => el.style.transition = 'none'); window.addEventListener('mousemove', this.boundMouseMove); window.addEventListener('mouseup', this.boundMouseUp); }
    handleMouseMove(e) { if (this.isPanning) { const dX = e.clientX - this.lastPanPoint.x; const dY = e.clientY - this.lastPanPoint.y; this.panPosition.x += dX; this.panPosition.y += dY; this.lastPanPoint = { x: e.clientX, y: e.clientY }; this.updateMapTransform(); } else if (this.lineStartPoint) { const eP = this.getNormalisedCursorPoint(e); if (!eP) return; const pL = this.linesLayer.querySelector('#line-preview'); if (pL) { const w = this.mapImage.width, h = this.mapImage.height; pL.setAttribute('x1', this.lineStartPoint.x * w); pL.setAttribute('y1', this.lineStartPoint.y * h); pL.setAttribute('x2', eP.x * w); pL.setAttribute('y2', eP.y * h); } } }
    handleMouseUp(e) { window.removeEventListener('mousemove', this.boundMouseMove); window.removeEventListener('mouseup', this.boundMouseUp); if (this.isPanning) { this.isPanning = false; this.mapWrapper.style.cursor = this.isDrawingLine ? 'crosshair' : ''; [this.mapImage, this.annotationsLayer, this.linesLayer].forEach(el => el.style.transition = 'transform var(--transition-fast)'); } if (this.lineStartPoint) { const endPoint = this.getNormalisedCursorPoint(e); if (endPoint && this.dragJustFinished) { if (!this.currentMap.lines) this.currentMap.lines = []; this.currentMap.lines.push({ id: Date.now().toString(), start: this.lineStartPoint, end: endPoint, color: this.lineColor }); this.markCurrentMapDirty(); this.renderLines(); } this.lineStartPoint = null; const preview = this.linesLayer.querySelector('#line-preview'); if (preview) preview.remove(); } }
    handleZoom(e) { e.preventDefault(); const delta = e.deltaY > 0 ? 0.9 : 1.1; const newScale = Math.max(0.5, Math.min(5, this.scale * delta)); if (newScale !== this.scale) { const rect = this.mapWrapper.getBoundingClientRect(); const mX = e.clientX - rect.left; const mY = e.clientY - rect.top; const wX = (mX - this.panPosition.x) / this.scale; const wY = (mY - this.panPosition.y) / this.scale; this.scale = newScale; this.panPosition.x = mX - wX * newScale; this.panPosition.y = mY - wY * newScale; this.updateMapTransform(); } }
    resetView() { this.scale = 1; this.panPosition = { x: 0, y: 0 }; this.updateMapTransform(); }
    updateMapTransform() { const transform = `translate(${this.panPosition.x}px, ${this.panPosition.y}px) scale(${this.scale})`; [this.mapImage, this.annotationsLayer, this.linesLayer].forEach(el => { if(el) el.style.transform = transform; }); this.annotationsLayer.style.setProperty('--marker-scale', 1 / this.scale); }
    handleKeyDown(e) { if (e.key === 'Escape') { if (this.isDrawingLine) this.exitLineDrawingMode(); else this.closeTopModal(); } }
}

document.addEventListener('DOMContentLoaded', () => {
    new WarThunderMaps();
});
