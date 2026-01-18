// --- REFERENCIAS DOM ---
const btnPagoMes = document.getElementById('btn-pago-mes');
const inputNic = document.getElementById('input-nic');
const spinnerNic = document.getElementById('spinner-nic');
const hiddenFields = document.getElementById('hidden-fields');
const invoiceBody = document.getElementById('invoice-body');

// Referencias del Modal
const infoModal = document.getElementById('info-modal');
const btnCloseX = document.getElementById('btn-close-x');
const btnAcceptModal = document.getElementById('btn-accept-modal');

// Variable global
let datosParaPago = null;

// --- 0. LÓGICA MODAL DE BIENVENIDA (ACTUALIZADA) ---
// Usamos DOMContentLoaded para asegurar que el HTML esté listo antes de abrir
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if(infoModal) {
            infoModal.classList.add('open-modal');
        }
    }, 500); // Pequeño retardo de medio segundo para efecto visual suave
});

function cerrarModal() {
    if(infoModal) infoModal.classList.remove('open-modal');
}

if(btnCloseX) btnCloseX.addEventListener('click', cerrarModal);
if(btnAcceptModal) btnAcceptModal.addEventListener('click', cerrarModal);


// --- 1. CLICK EN BOTÓN "PAGO MES" (BUSCAR) ---
if (btnPagoMes) {
    btnPagoMes.addEventListener('click', async () => {
        const rawValue = inputNic.value.trim();
        
        if (!rawValue) { alert("Ingrese un NIC."); return; }

        // --- LIMPIEZA DEL NIC ---
        // 1. split('-')[0] -> Toma lo que está antes del primer guion
        // 2. replace(/\D/g, '') -> Elimina todo lo que NO sea número (letras, espacios, simbolos)
        const nicValue = rawValue.split('-')[0].replace(/\D/g, '');

        console.log(`Original: "${rawValue}" -> Procesado: "${nicValue}"`);

        if (!nicValue) { alert("El NIC no contiene números válidos."); return; }

        // UI Reset
        spinnerNic.classList.remove('hidden');
        hiddenFields.classList.add('hidden');
        invoiceBody.innerHTML = ''; 

        try {
            // URL con el NIC LIMPIO
            const targetUrl = `https://caribemar.facture.co/DesktopModules/GatewayOficinaVirtual.Commons/API/Pdf/GetVolantePagoCBView?id=${nicValue}&tipoDocumento=FA&ind_Representacion=true`;
            const proxyUrl = `https://corsproxy.io/?` + encodeURIComponent(targetUrl);

            // Leer PDF
            const loadingTask = pdfjsLib.getDocument(proxyUrl);
            const pdf = await loadingTask.promise;
            const page = await pdf.getPage(1);
            const textContent = await page.getTextContent();
            const fullText = textContent.items.map(item => item.str).join(' ');

            console.log("Texto PDF:", fullText);

            // Regex extracción
            const matchValor = fullText.match(/Valor Mes\s*\$\s*([\d\.,]+)/i);
            const matchVence = fullText.match(/F\. Pago oportuno:\s*(\d{2}\/\d{2}\/\d{4})/i);
            const matchFactura = fullText.match(/ID de Cobros:\s*(\d+)/i);
            const matchPeriodo = fullText.match(/(\d{2}\/\d{2}\/\d{4}\s*-\s*\d{2}\/\d{2}\/\d{4})/);
            
            const matchNombre = fullText.match(/([A-Z\sÑ]+)\s+NIC:/);
            let nombreCliente = matchNombre ? matchNombre[1].trim().replace("Pagar Factura", "").trim() : "USUARIO AFINIA";

            if (matchValor && matchValor[1]) {
                const valorStr = matchValor[1];
                
                datosParaPago = {
                    nombre: nombreCliente,
                    nic: nicValue, // Usamos el NIC limpio
                    referencia: matchFactura ? matchFactura[1] : nicValue + "001",
                    periodo: matchPeriodo ? matchPeriodo[0] : "2025/01", 
                    vence: matchVence ? matchVence[1] : "Inmediato",
                    valor: valorStr,
                    montoNumber: parseFloat(valorStr.replace(/\./g, '').replace(',', '.'))
                };

                renderPixelPerfectRow(datosParaPago);

                spinnerNic.classList.add('hidden');
                hiddenFields.classList.remove('hidden');

            } else {
                throw new Error("No se encontraron datos en la factura.");
            }

        } catch (error) {
            console.error(error);
            spinnerNic.classList.add('hidden');
            alert("No se pudo consultar el NIC o no existe.");
        }
    });
}

// --- 2. FUNCIÓN RENDERIZADO (Orden Móvil) ---
function renderPixelPerfectRow(data) {
    const tr = document.createElement('tr');
    
    let periodoVisual = "2024/12"; 
    try {
        const parts = data.periodo.split('/'); 
        if(parts.length > 2) periodoVisual = `${parts[2].substr(0,4)}/${parts[1]}`; 
    } catch(e){}

    tr.innerHTML = `
        <td class="col-check"><div class="row-check"></div></td>
        <td class="col-icons">
            <div class="doc-icon-group">
                <span class="material-icons icon-doc-svg">description</span>
                <span class="material-icons icon-doc-svg">picture_as_pdf</span>
            </div>
        </td>

        <td class="col-valor" style="font-weight:700;">$ ${data.valor}</td>
        <td class="col-saldo">$ ${data.valor}</td>

        <td class="col-estado">
            <div class="status-circle-money">$</div>
        </td>
        <td class="col-factura">${data.referencia}</td>
        <td class="col-nic">${data.nic}</td>
        <td class="col-periodo">${periodoVisual}</td>
        <td class="col-vence">${data.vence}</td>
        <td class="col-consumo">139</td>
        <td class="col-accion sticky-col">
            <button type="button" class="btn-pagar-pro" onclick="irAPagar(event)">PAGAR</button>
        </td>
    `;
    invoiceBody.appendChild(tr);
}

// --- 3. REDIRECCIÓN ---
window.irAPagar = function(e) {
    if(e) e.preventDefault(); 
    if (!datosParaPago) return;
    sessionStorage.setItem('datosFactura', JSON.stringify(datosParaPago));
    window.location.href = 'datos.html';
};

// Menú lateral
const menuBtn = document.getElementById('menu-toggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('menu-overlay');
function toggleMenu() { sidebar.classList.toggle('open'); overlay.classList.toggle('active'); }
if(menuBtn) menuBtn.addEventListener('click', toggleMenu);
if(overlay) overlay.addEventListener('click', toggleMenu);