(function() {
  function validEmail(email) {
    var re = /^([\w-]+(?:\.[\w-]+)*)@((?:[\w-]+\.)*\w[\w-]{0,66})\.([a-z]{2,6}(?:\.[a-z]{2})?)$/i;
    return re.test(email);
  }

  function validateHuman(honeypot) {
    if (honeypot) {  // if hidden form filled up
      return true;
    }
  }

  // get all data in form and return object
  function getFormData(form) {
    var elements = form.elements;
    var fields = Object.keys(elements).filter(function(k) {
      return (elements[k].name !== "honeypot");
    }).map(function(k) {
      if(elements[k].name !== undefined) {
        return elements[k].name;
      // special case for Edge's html collection
      } else if(elements[k].length > 0){
        return elements[k].item(0).name;
      }
    }).filter(function(item, pos, self) {
      return self.indexOf(item) == pos && item;
    });

    var formData = {};
    fields.forEach(function(name){
      var element = elements[name];
      
      // singular form elements just have one value
      formData[name] = element.value;

      // when our element has multiple items, get their values
      if (element.length) {
        var data = [];
        for (var i = 0; i < element.length; i++) {
          var item = element.item(i);
          if (item.checked || item.selected) {
            data.push(item.value);
          }
        }
        formData[name] = data.join(', ');
      }
    });

    // add form-specific values into the data
    formData.formDataNameOrder = JSON.stringify(fields);
    formData.formGoogleSheetName = form.dataset.sheet || "responses"; // default sheet name
    formData.formGoogleSendEmail = form.dataset.email || ""; // no email by default

    return formData;
  }

  function handleFormAnswer(event) {
    // event.preventDefault(); 
    var form = document.querySelectorAll("form.gform")[0];
    var data = getFormData(form) 
    if(validateHuman(data.honeypot)) {
      return false; 
    }
    
    var currentQuestion = event.target.getAttribute('data-question');
    var nextQuestion = parseInt(currentQuestion) + 1; 
    if(currentQuestion <= 3) {
      document.getElementById('questionnaire-box').classList.add("animated", "flipOutX");
      window.setTimeout(function() {

        if(parseInt(currentQuestion) === 3) {
          document.getElementById('progress-label').style.display = 'none';
        }

        document.getElementById('question-' + currentQuestion).classList.remove("visible"); 
        document.getElementById('question-' + nextQuestion).classList.add("visible"); 
        document.getElementById('questionnaire-box').classList.remove("animated", "flipOutX");
        document.getElementById('current-question-number').innerHTML = nextQuestion;
        window.setTimeout(function() {
          document.getElementById('progress-bar').style.width = currentQuestion * 33.3333333 + '%';

          if(parseInt(currentQuestion) === 3) {
            document.getElementById('progress-bar').style.borderTopRightRadius = '4px';
          }
        }, 500)
      }, 600)
    }

    if(event.target.name === 'email-submit' && !validEmail(document.getElementById('email').value)) {
      return false; 
    }

    // if(parseInt(currentQuestion) === 4) {
    //   document.getElementById('question-4').classList.remove("visible"); 
    //   document.getElementById('question-5').classList.add("visible"); 
    // }

    var url = form.action;
    var xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
    xhr.onreadystatechange = function() {
        return;
    };
    
    var encoded = [
                    encodeURIComponent(event.target.name === 'email-submit' ? 'email' : event.target.name) + "=" + encodeURIComponent(event.target.name === 'email-submit' ? document.getElementById('email').value : event.target.value), 
                    encodeURIComponent('identifier') + "=" + encodeURIComponent(data['identifier']), 
                    encodeURIComponent('is-repetitive-ip') + "=" + encodeURIComponent(data['is-repetitive-ip'])
                  ].join('&');
    xhr.send(encoded);

    if(event.target.name === 'email-submit') {
      var emailBox = document.getElementById('email-box');
      emailBox.innerHTML = '<strong>Thank you for subscribing. We\'ll be in touch.</strong>';
    }
  }

  function handleFormSubmit(event) {  // handles form submit without any jquery
    event.preventDefault();           // we are submitting via xhr below
    var form = event.target;
    var data = getFormData(form);         // get the values submitted in the form

    // OPTION: Remove this comment to enable SPAM prevention, see README.md
    if (validateHuman(data.honeypot)) {  //if form is filled, form will not be submitted
      return false;
    }

    if( data.email && !validEmail(data.email) ) {   // if email is not valid show error
      var invalidEmail = form.querySelector(".email-invalid");
      if (invalidEmail) {
        invalidEmail.style.display = "block";
        return false;
      }
    } else {
      disableAllButtons(form);
      var url = form.action;
      var xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
      xhr.onreadystatechange = function() {
          var formElements = form.querySelector(".form-elements")
          if (formElements) {
            formElements.style.display = "none"; // hide form
          }
          var thankYouMessage = form.querySelector(".thankyou_message");
          if (thankYouMessage) {
            thankYouMessage.style.display = "block";
          }
          return;
      };
      // url encode form data for sending as post data
      var encoded = Object.keys(data).map(function(k) {
          return encodeURIComponent(k) + "=" + encodeURIComponent(data[k]);
      }).join('&');
      xhr.send(encoded);
    }
  }

  function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  
    for (var i = 0; i < 20; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
  }
  
  function loaded() {
    // bind to the submit event of our form
    var forms = document.querySelectorAll("form.gform");
    for (var i = 0; i < forms.length; i++) {
      forms[i].addEventListener("submit", handleFormSubmit, false);
    }

    var answers = document.querySelectorAll(".instant-send"); 
    for (var i = 0; i < answers.length; i++) {
      answers[i].addEventListener("click", handleFormAnswer, false)
    }

    document.getElementById('identifier').value = makeid() 
  };

  document.addEventListener("DOMContentLoaded", loaded, false);
  document.getElementById('question-1').classList.add("visible"); 
  // function disableAllButtons(form) {
  //   var buttons = form.querySelectorAll("button");
  //   for (var i = 0; i < buttons.length; i++) {
  //     buttons[i].disabled = true;
  //   }
  // }
})();