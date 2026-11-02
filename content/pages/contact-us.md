---
title: Contact Us
show_title: true
placement: Menu
menu_order: 50
sections:
  - type: html
    code: |
      <div class="contact-form-wrap">
        <p>Have a question, a thought to share, or a reason to get in touch? Send a message below.</p>
        <form id="er-contact-form" class="contact-form">
          <label for="er-name">Name</label>
          <input id="er-name" name="name" type="text" maxlength="100" autocomplete="name" required>
          <label for="er-email">Email address</label>
          <input id="er-email" name="email" type="email" maxlength="254" autocomplete="email" required>
          <label for="er-message">Message</label>
          <textarea id="er-message" name="message" rows="7" maxlength="5000" required></textarea>
          <div class="er-trap" aria-hidden="true"><label for="er-website">Leave this field empty</label><input id="er-website" name="website" tabindex="-1" autocomplete="off"></div>
          <button class="btn" type="submit">Send message</button>
          <p id="er-contact-status" role="status" aria-live="polite"></p>
        </form>
      </div>
      <style>
      .contact-form-wrap{max-width:650px;margin:1.5rem auto 4rem}.contact-form{display:grid;gap:.65rem}.contact-form label{font-weight:650;margin-top:.65rem}.contact-form input,.contact-form textarea{width:100%;font:inherit;padding:.85rem;border:1px solid #cbd2dc;border-radius:6px;background:#fff;color:#101d34}.contact-form textarea{resize:vertical}.contact-form button{justify-self:start;border:0;cursor:pointer}.er-trap{position:absolute;left:-10000px;width:1px;height:1px;overflow:hidden}
      </style>
      <script>
      (function(){var f=document.getElementById('er-contact-form');if(!f)return;var status=document.getElementById('er-contact-status');f.addEventListener('submit',async function(e){e.preventDefault();var b=f.querySelector('button[type="submit"]');b.disabled=true;b.textContent='Sending…';status.textContent='';var data=Object.fromEntries(new FormData(f).entries());try{var r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});var result=await r.json();if(!r.ok)throw Error(result.error||'Message could not be sent.');f.reset();status.textContent='Your message has been sent. Thank you for reaching out.';}catch(err){status.textContent=err.message||'Something went wrong. Please try again.';}finally{b.disabled=false;b.textContent='Send message';}});})();
      </script>
