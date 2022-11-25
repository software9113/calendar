(function () {
    setTimeout(() => {
        const {
            $,
            __store__,
            sharedFunctions: {
                appUsers,
                createMeeting,
                getMeetings,
                appCalendar
            },
            FullCalendar,
            M, moment
        } = window;
        const FORMAT_DATE = 'YYYY-MM-DD';

        const selectBooking = $('#booking-paticipants');
        selectBooking.append(`${appUsers.getUsers().map(item => `<option value="${item.value}">${item.label}</option>`).join('')}`)

        let elems = document.querySelectorAll('.modal');
        const templateId = elems[0].getAttribute('template-id')
        let date = ''
        let instances = M.Modal.init(elems)

        let selects = document.querySelectorAll('select');
        window.M.FormSelect.init(selects);

        let calendarEl = document.getElementById('calendar-body');

        let calendar = new FullCalendar.Calendar(calendarEl, {
            initialView: 'dayGridMonth',
            headerToolbar: {
                left: 'prev,next,today',
                center: 'title',
                right: '',
            },
            dateClick: function (info) {
                $("#booking-paticipants").val([''])
                const { dateStr } = info;

                if (new Date(dateStr).getTime() < new Date(moment().format(FORMAT_DATE)).getTime()) {
                    return
                } else {
                    instances[0].open()
                    date = info
                }
            },
            eventClick: function (info) {
                console.log("event>>>>>>>", info.event.startTime)
                console.log("event>>>>>>>", info.event.endTime)
                // info.el.style.borderColor = 'red';
            },
            events: [],
            customButtons: {
                next: {
                    click: function (ev) {
                        appCalendar.nextMonth()
                        callEveltsCalendar(appCalendar.getFirstDayOfMonth(), appCalendar.getLastDayOfMonth())
                        calendar.next()
                    }
                },
                prev: {
                    click: function (ev) {
                        appCalendar.prevMonth()
                        callEveltsCalendar(appCalendar.getFirstDayOfMonth(), appCalendar.getLastDayOfMonth())
                        calendar.prev()
                    },
                },
                today: {
                    text: 'Today',
                    click: function (ev) {
                        appCalendar.today()
                        callEveltsCalendar(appCalendar.getFirstDayOfMonth(), appCalendar.getLastDayOfMonth())
                        calendar.today()
                    }
                }
            }
        });
        calendar.render()

        callEveltsCalendar(appCalendar.getFirstDayOfMonth(), appCalendar.getLastDayOfMonth())
        function callEveltsCalendar(sartDate, endDate) {
            calendar.removeAllEvents();
            getMeetings(moment(sartDate).format(FORMAT_DATE), moment(endDate).format(FORMAT_DATE)).then(res => {
                res.map((item) => {
                    calendar.addEvent({
                        id: item.createdAt,
                        title: item.subject,
                        start: moment(item.startTime).format(FORMAT_DATE),
                        startTime: moment(item.startTime).format('YYYY-MM-DDTh:mm:ss'),
                        endTime: moment(item.endTime).format('YYYY-MM-DDTh:mm:ss')
                    })
                })
            })

        }


        $('#sub-booking').on('click', function () {
            const formBooking = document.forms["booking-form"];
            const { dateStr } = date;
            if (formBooking["subject"].value && formBooking["startTime"].value && formBooking["endTime"].value && $("#booking-paticipants").val() != '' && formBooking["location"].value) {
                createMeeting({
                    "meetingTemplateDataId": templateId,
                    "startTime": moment(`${dateStr}T${formBooking["startTime"].value}`).format(),
                    "endTime": moment(`${dateStr}T${formBooking["endTime"].value}`).format(),
                    "subject": formBooking["subject"].value,
                    "paticipants": $("#booking-paticipants").val(),
                    "type": "user",
                    location: formBooking["location"].value

                }).then((res) => {


                    calendar.addEvent({
                        title: res.subject,
                        start: res.startTime?.substring(0, 19),
                        end: res.endTime?.substring(0, 19)
                    })
                    $("#subject").val('')
                    $("#startTime").val('')
                    $("#endTime").val('')
                    $("#location").val('')
                    $("#booking-paticipants").val([])
                    instances[0].close()
                })
            }

        })
    }, 3000)
})()