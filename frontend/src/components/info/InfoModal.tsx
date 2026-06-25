import { Button, cn, Modal } from '@heroui/react'
import { CircleQuestionMark } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../layout/LanguageSwitcher';
import { ThemeSwitcher } from '../layout/ThemeSwitcher';
import { useLocation } from 'react-router-dom';

type MyModalProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
};

export function InfoModal({
    onOpenChange,
    isOpen
}: MyModalProps) {
    const { i18n } = useTranslation();
    const isGerman = i18n.language.startsWith("de");
    const location = useLocation();

    const overviewRef = useRef<HTMLDivElement>(null);
    const basicsRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);
    const projectRef = useRef<HTMLDivElement>(null);
    const taskRef = useRef<HTMLDivElement>(null);
    const createTaskRef = useRef<HTMLDivElement>(null);
    const assignTaskRef = useRef<HTMLDivElement>(null);
    const chatRef = useRef<HTMLDivElement>(null);
    const chatEverywhereRef = useRef<HTMLDivElement>(null);
    const whiteboardRef = useRef<HTMLDivElement>(null);
    const whiteboardTemplatesRef = useRef<HTMLDivElement>(null);

    const advancedRef = useRef<HTMLDivElement>(null);
    const automaticTaskAssignmentRef = useRef<HTMLDivElement>(null);
    const skillsRef = useRef<HTMLDivElement>(null);
    const workinghoursRef = useRef<HTMLDivElement>(null);
    const taskSchedulerRef = useRef<HTMLDivElement>(null);
    const taskWhiteboardLinkingRef = useRef<HTMLDivElement>(null);

    const [activeSection, setActiveSection] = useState("overview");

    useEffect(() => {
        if (!isOpen) return;

        const sections = [
            { id: "overview", ref: overviewRef },
            { id: "basics", ref: basicsRef },
            { id: "profile", ref: profileRef },
            { id: "project", ref: projectRef },
            { id: "task", ref: taskRef },
            { id: "createTask", ref: createTaskRef },
            { id: "assignTask", ref: assignTaskRef },
            { id: "chat", ref: chatRef },
            { id: "chatEverywhere", ref: chatEverywhereRef },
            { id: "whiteboard", ref: whiteboardRef },
            { id: "whiteboardTemplates", ref: whiteboardTemplatesRef },
            { id: "advanced", ref: advancedRef },
            { id: "automaticTaskAssignment", ref: automaticTaskAssignmentRef },
            { id: "skills", ref: skillsRef },
            { id: "workinghours", ref: workinghoursRef },
            { id: "taskScheduler", ref: taskSchedulerRef },
            { id: "taskWhiteboardLinking", ref: taskWhiteboardLinkingRef },
        ];

        const observer = new IntersectionObserver(
            (entries) => {
                const visibleSections = entries
                    .filter((entry) => entry.isIntersecting)
                    .sort(
                        (a, b) =>
                            b.intersectionRatio - a.intersectionRatio
                    );

                if (visibleSections.length > 0) {
                    setActiveSection(
                        visibleSections[0].target.id
                    );
                }
            },
            {
                threshold: 0,
            }
        );

        sections.forEach(({ ref }) => {
            if (ref.current) {
                observer.observe(ref.current);
            }
        });

        return () => observer.disconnect();
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        const pageToSection: Record<string, RefObject<HTMLDivElement | null>> = {
            "tasks": taskRef,
            "chat": chatRef,
            "whiteboard": whiteboardRef,
            "project": projectRef,
            "profile": profileRef,
        };

        let section = overviewRef;
        for (const s of Object.keys(pageToSection)) {
            if (location.pathname.includes(s)) {
                section = pageToSection[s];
                break;
            }
        }
        requestAnimationFrame(() => {
            section?.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
        });
    }, [isOpen, location.pathname]);

    const scrollToSection = (
        ref: React.RefObject<HTMLDivElement | null>
    ) => {
        ref.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };



    const germanVersion = (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="cover">
                    <Modal.Dialog>
                        <Modal.Header>The STRIDE Guide™</Modal.Header>

                        <Modal.Body>
                            <div className="flex h-full">
                                {/* Sidebar */}
                                <aside className="w-90 border-r p-2 flex flex-col gap-1">
                                    <AsideButton
                                        refObj={overviewRef}
                                        section="overview"
                                        text="Übersicht"
                                        activeSection={activeSection}
                                        scrollToSection={scrollToSection}
                                    />

                                    <AsideButton
                                        refObj={basicsRef}
                                        section="basics"
                                        text="Grundlagen"
                                        activeSection={activeSection}
                                        scrollToSection={scrollToSection}
                                    />

                                    <div className="ml-4 border-l pl-3 flex flex-col gap-1">

                                        <AsideButton
                                            refObj={profileRef}
                                            section="profile"
                                            text="Profilverwaltung"
                                            activeSection={activeSection}
                                            scrollToSection={scrollToSection}
                                        />

                                        <AsideButton
                                            refObj={projectRef}
                                            section="project"
                                            text="Projekt erstellen und verwalten"
                                            activeSection={activeSection}
                                            scrollToSection={scrollToSection}
                                        />

                                        <div>
                                            <AsideButton
                                                refObj={taskRef}
                                                section="task"
                                                text="Aufgabenverwaltung"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />

                                            <div className="ml-4 border-l mt-1 flex flex-col gap-1">

                                                <AsideButton
                                                    refObj={createTaskRef}
                                                    section="createTask"
                                                    text="Aufgaben erstellen und bearbeiten"
                                                    activeSection={activeSection}
                                                    scrollToSection={scrollToSection}
                                                />

                                                <AsideButton
                                                    refObj={assignTaskRef}
                                                    section="assignTask"
                                                    text="Aufgaben zuweisen"
                                                    activeSection={activeSection}
                                                    scrollToSection={scrollToSection}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <AsideButton
                                                refObj={chatRef}
                                                section="chat"
                                                text="Mit anderen chatten"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />
                                            <div className="ml-4 border-l mt-1 flex flex-col gap-1">
                                                <AsideButton
                                                    refObj={chatEverywhereRef}
                                                    section="chatEverywhere"
                                                    text="Überall chatten"
                                                    activeSection={activeSection}
                                                    scrollToSection={scrollToSection}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <AsideButton
                                                refObj={whiteboardRef}
                                                section="whiteboard"
                                                text="Whiteboard verwenden"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />
                                            <div className="ml-4 border-l mt-1 flex flex-col gap-1">
                                                <AsideButton
                                                    refObj={whiteboardTemplatesRef}
                                                    section="whiteboardTemplates"
                                                    text="Whiteboard-Vorlagen"
                                                    activeSection={activeSection}
                                                    scrollToSection={scrollToSection}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <AsideButton
                                        refObj={advancedRef}
                                        section="advanced"
                                        text="Erweitert"
                                        activeSection={activeSection}
                                        scrollToSection={scrollToSection}
                                    />

                                    <div className="ml-4 border-l pl-3 flex flex-col gap-1">
                                        <AsideButton
                                            refObj={automaticTaskAssignmentRef}
                                            section="automaticTaskAssignment"
                                            text="Automatische Aufgabenzuweisung"
                                            activeSection={activeSection}
                                            scrollToSection={scrollToSection}
                                        />

                                        <div className="ml-4 border-l mt-1 flex flex-col gap-1">
                                            <AsideButton
                                                refObj={skillsRef}
                                                section="skills"
                                                text="Fähigkeiten"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />

                                            <AsideButton
                                                refObj={workinghoursRef}
                                                section="workinghours"
                                                text="Arbeitsstunden"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />

                                            <AsideButton
                                                refObj={taskSchedulerRef}
                                                section="taskScheduler"
                                                text="Scheduler ausführen!"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />
                                        </div>
                                    </div>

                                    <div className="ml-4 border-l pl-3 flex flex-col gap-1">
                                        <AsideButton
                                            refObj={taskWhiteboardLinkingRef}
                                            section="taskWhiteboardLinking"
                                            text="Aufgaben-Whiteboard-Verknüpfung"
                                            activeSection={activeSection}
                                            scrollToSection={scrollToSection}
                                        />
                                    </div>
                                </aside>

                                {/* Scrollable content */}
                                <main
                                    className="flex-1 overflow-y-auto p-6"
                                >
                                    <section className="mb-12">
                                        <div
                                            id="overview"
                                            ref={overviewRef}
                                            className="mb-16"
                                        >
                                            <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight">
                                                Übersicht
                                            </h1>

                                            <p>
                                                Dieser kurze Guide soll dir einen vollständigen Überblick über die Funktionen von <code>STRIDE</code> geben.
                                                Du kannst diese Seite jederzeit über das <CircleQuestionMark className="inline h-5 w-5" /> Symbol in der Kopfzeile erneut öffnen.
                                            </p>

                                            <p className="mb-2">
                                                Der Guide behandelt folgende Themen:
                                            </p>

                                            <ul className="list-disc pl-6 space-y-2">
                                                <li>Profilverwaltung</li>
                                                <li>Projekt erstellen und verwalten</li>

                                                <li>
                                                    Aufgabenverwaltung
                                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                                        <li>Aufgaben erstellen und bearbeiten</li>
                                                        <li>Aufgaben zuweisen</li>
                                                    </ul>
                                                </li>

                                                <li>
                                                    Mit anderen chatten
                                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                                        <li>Überall chatten</li>
                                                    </ul>
                                                </li>

                                                <li>
                                                    Whiteboard verwenden
                                                </li>
                                            </ul>

                                            <p className="my-2">
                                                Der große Vorteil von <code>STRIDE</code> ist, dass alle Seiten und Funktionen miteinander verknüpft sind.
                                                Dadurch greifen die verschiedenen Bereiche der Anwendung nahtlos ineinander. Allerdings braucht man dadurch auch
                                                etwas mehr Wissen über die App, um alle Möglichkeiten wirklich auszunutzen. Wir empfehlen deshalb, zuerst die
                                                oben genannten Grundlagen durchzulesen, bevor du dich an die erweiterten Themen wagst.
                                                Der folgende Abschnitt behandelt:
                                            </p>

                                            <ul className="list-disc pl-6 space-y-2">
                                                <li>
                                                    Fähigkeiten
                                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                                        <li>Fähigkeiten als Projektbesitzer definieren</li>
                                                        <li>Dir selbst Fähigkeiten zuweisen</li>
                                                        <li>Erforderliche Fähigkeiten für Aufgaben festlegen</li>
                                                    </ul>
                                                </li>

                                                <li>
                                                    Aufgaben automatisch zuweisen
                                                </li>

                                                <li>
                                                    Deine Whiteboard-Zeichnungen mit Aufgaben verknüpfen
                                                </li>
                                            </ul>

                                        </div>
                                    </section>

                                    <section className="mb-12">
                                        <div
                                            id="basics"
                                            ref={basicsRef}
                                            className="mb-16"
                                        >
                                            <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight">
                                                Grundlagen
                                            </h1>

                                            <div
                                                id="profile"
                                                ref={profileRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Profilverwaltung
                                                </h1>

                                                <p>
                                                    Oben rechts findest du einen Button mit deinem Namen. Wenn du darauf klickst,
                                                    gelangst du zu deinem Profil. Es sollte ungefähr so aussehen
                                                    (das Profilbild kannst du ignorieren!).
                                                </p>

                                                <GuideImg name='profile1.png' isGerman={isGerman} />

                                                <p>
                                                    Die ersten beiden Tabs sind ziemlich standardmäßig und erlauben dir,
                                                    deinen Namen, dein Passwort und deine E-Mail-Adresse zu ändern.
                                                    Um die Tabs für Fähigkeiten und Arbeitsstunden musst du dir noch keine
                                                    Gedanken machen - die gehören zu den erweiterten Themen.
                                                </p>
                                            </div>

                                            <div
                                                id="project"
                                                ref={projectRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Projekt erstellen und verwalten
                                                </h1>

                                                <p>
                                                    Wir erstellen jetzt schnell ein neues Projekt. Dieses großartige Projekt
                                                    verwenden wir als Referenzprojekt für alles, was danach kommt!
                                                    (Hinweis: Du kannst den Namen natürlich frei wählen.)
                                                </p>

                                                <GuideImg name='project-create.gif' isGerman={isGerman} />
                                                <br />

                                                <p>
                                                    Fügen wir jetzt ein paar Mitglieder hinzu. Das kannst du entweder direkt
                                                    über den Button „Mitglieder hinzufügen“ machen oder über die
                                                    Projekteinstellungen. Dort kannst du Mitglieder auch wieder entfernen
                                                    (falls sich jemand danebenbenimmt).
                                                </p>

                                                <GuideImg name='project-addmembers.gif' isGerman={isGerman} />
                                                <br />

                                                <p>
                                                    Wenn du mit einem Projekt fertig bist, kannst du es entweder archivieren,
                                                    sodass nichts mehr bearbeitet werden kann, oder komplett löschen
                                                    (das lässt sich nicht rückgängig machen!).
                                                    <br />
                                                    <br />
                                                    Archivierte Projekte erscheinen außerdem in einem eigenen Bereich und
                                                    können jederzeit wieder aus dem Archiv geholt werden.
                                                </p>

                                                <GuideImg name="project-archive.gif" isGerman={isGerman} />
                                            </div>

                                            <div
                                                id="task"
                                                ref={taskRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Aufgabenverwaltung
                                                </h1>

                                                <p>
                                                    Jetzt, da dein Projekt eingerichtet ist, wird es Zeit, ein paar Aufgaben
                                                    anzulegen. Aufgaben erlauben es dir, Arbeitspakete zu definieren, die
                                                    innerhalb eines bestimmten Zeitraums erledigt werden müssen.
                                                    Später (im Abschnitt „Erweitert“) siehst du außerdem, wie du Aufgaben mit
                                                    dem Whiteboard verknüpfen kannst und wie Fähigkeiten sowie Arbeitslast dabei
                                                    berücksichtigt werden können.
                                                    <br />
                                                    <br />
                                                    Beachte, dass es zwei Ansichten gibt: das Kanban-Board und eine einfache
                                                    Liste. Du kannst frei wählen, welche du verwenden möchtest - keine von
                                                    beiden kann mehr als die andere. In diesem Guide verwenden wir das
                                                    Kanban-Board.
                                                </p>

                                                <div
                                                    id="createTask"
                                                    ref={createTaskRef}
                                                    className="my-8 border-l pl-4"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">
                                                        Aufgaben erstellen und bearbeiten
                                                    </h1>

                                                    <p>
                                                        Um eine Aufgabe zu erstellen, gehe einfach in die Spalte deiner Wahl
                                                        (wahrscheinlich „To Do“) und vergib einen aussagekräftigen Titel,
                                                        der einen groben Überblick über die Aufgabe gibt.
                                                        Anschließend kannst du die Aufgabe öffnen und eine Beschreibung
                                                        hinzufügen sowie festlegen, wie lange sie ungefähr dauern wird und
                                                        in welchem Zeitraum daran gearbeitet werden darf.
                                                        <br />
                                                        <i>
                                                            Beachte, dass alle Felder komplett optional sind. Einige davon
                                                            solltest du aber ausfüllen, wenn du später die erweiterten
                                                            Funktionen nutzen möchtest.
                                                        </i>
                                                    </p>

                                                    <GuideImg name="task-create-and-edit.gif" isGerman={isGerman} />
                                                </div>

                                                <div
                                                    id="assignTask"
                                                    ref={assignTaskRef}
                                                    className="my-8 border-l pl-4"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">
                                                        Aufgaben zuweisen
                                                    </h1>

                                                    <p>
                                                        Du kannst jedes Teammitglied jeder Aufgabe zuweisen und so verwalten,
                                                        wer für welche Aufgabe verantwortlich ist.<br />
                                                        <i>
                                                            Im Abschnitt „Erweitert“ schauen wir uns später an,
                                                            wie dieser Prozess automatisiert und optimiert werden kann!
                                                        </i>
                                                    </p>

                                                    <GuideImg name="task-assign.gif" isGerman={isGerman} />
                                                </div>
                                            </div>

                                            <div
                                                id="chat"
                                                ref={chatRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Mit anderen chatten
                                                </h1>

                                                <p>
                                                    Die letzte Seite ist der Chat! Der Chat ist ganz einfach:
                                                    Du kannst Nachrichten schreiben, bearbeiten oder löschen,
                                                    falls du bereust, was du geschrieben hast.
                                                </p>

                                                <GuideImg name="chat.gif" isGerman={isGerman} />

                                                <div
                                                    id="chatEverywhere"
                                                    ref={chatEverywhereRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Überall chatten
                                                    </h1>

                                                    <p>
                                                        Du musst nicht extra auf die Chat-Seite wechseln, um den Chat zu öffnen.
                                                        Du kannst ihn auch direkt auf der Aufgaben- oder Whiteboard-Seite verwenden.
                                                    </p>

                                                    <GuideImg name="chat-everywhere-task.gif" isGerman={isGerman} />
                                                    <br />
                                                    <hr />
                                                    <br />
                                                    <GuideImg name="chat-everywhere-whiteboard.gif" isGerman={isGerman} />
                                                </div>
                                            </div>

                                            <div
                                                id="whiteboard"
                                                ref={whiteboardRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Whiteboard verwenden
                                                </h1>

                                                <p>
                                                    Das kollaborative Whiteboard eignet sich hervorragend für Brainstorming
                                                    oder das Entwerfen komplexerer Systeme. Falls du es noch nicht kennst:
                                                    Das Whiteboard basiert auf <a href="https://excalidraw.com/">Excalidraw</a>.
                                                </p>

                                                <GuideImg name="whiteboard.gif" isGerman={isGerman} />

                                                <div
                                                    id="whiteboardTemplates"
                                                    ref={whiteboardTemplatesRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Whiteboard-Vorlagen
                                                    </h1>

                                                    <p>
                                                        Für den Einstieg haben wir einige Vorlagen erstellt, die du verwenden
                                                        kannst. Vorlagen bestehen einfach aus normalen Excalidraw-Zeichnungen
                                                        und können beliebig bearbeitet werden.
                                                        Natürlich kannst du sie so oft verwenden, wie du möchtest - sogar
                                                        mehrfach im selben Whiteboard. Sie werden einfach an deiner aktuellen
                                                        Position eingefügt.
                                                    </p>

                                                    <GuideImg name="whiteboard-templates.gif" isGerman={isGerman} />
                                                </div>
                                            </div>
                                        </div>
                                    </section>

                                    <section id="settings" className="mb-12">
                                        <div
                                            id="advanced"
                                            ref={advancedRef}
                                            className="mb-16"
                                        >
                                            <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight">
                                                Erweitert
                                            </h1>

                                            <div
                                                id="automaticTaskAssignment"
                                                ref={automaticTaskAssignmentRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Automatische Aufgabenzuweisung
                                                </h1>

                                                <p>
                                                    Wie bereits im Abschnitt „Aufgaben zuweisen“ erwähnt, kannst du diesen
                                                    Prozess vollständig automatisieren und eine optimierte Liste von
                                                    Aufgabenzuweisungen erhalten. Das System ist allerdings keine Magie und
                                                    ruft auch nicht einfach ChatGPT im Hintergrund auf. Damit der sogenannte
                                                    Aufgaben-Scheduler (sehr kreativer Name) sinnvoll arbeiten kann, musst du
                                                    zwei Dinge bereitstellen, über die wir bisher noch nicht gesprochen haben: <b>Fähigkeiten</b> und <b>Arbeitsstunden</b>.
                                                </p>

                                                <br />

                                                <p>
                                                    In den folgenden Unterabschnitten zeigen wir dir, wie du diese anlegst
                                                    und verwendest. Zunächst erklären wir aber kurz, was sie sind und wie
                                                    sie den Aufgaben-Scheduler beeinflussen.
                                                    <br />

                                                    <b>Fähigkeiten:</b> Stell dir vor, du arbeitest in einem Projekt für eine
                                                    öffentliche Website. Jemand muss den Code schreiben, jemand anderes den
                                                    Server einrichten und überwachen und eine dritte Person kümmert sich um
                                                    Marketing. Es gibt viele Aufgaben im Projekt, aber es wäre vermutlich
                                                    keine gute Idee, wenn der Scheduler die Aufgabe „Große Marketingkampagne“
                                                    dem Programmierer zuweist, oder?

                                                    Fähigkeiten erlauben es dir, genau dieses Wissen abzubilden. Der
                                                    Projektbesitzer kann Fähigkeiten definieren, die für das Projekt relevant
                                                    sind. Aufgaben können anschließend eine Liste benötigter Fähigkeiten
                                                    erhalten. Jeder Benutzer wählt dann aus, welche Fähigkeiten er besitzt.
                                                    Der Scheduler weist eine Aufgabe nur dann einer Person zu, wenn diese
                                                    alle erforderlichen Fähigkeiten erfüllt.

                                                    <br />
                                                    <br />

                                                    <b>Arbeitsstunden:</b> Um die Arbeitslast fair zu verteilen, kannst du
                                                    festlegen, wie viele Stunden pro Woche du für ein bestimmtes Projekt
                                                    investieren möchtest. Damit das funktioniert, solltest du außerdem
                                                    schätzen, wie lange eine Aufgabe dauert. Wenn alles eingerichtet ist,
                                                    achtet der Scheduler darauf, dass deine wöchentlichen Arbeitsstunden
                                                    nicht überschritten werden.
                                                </p>

                                                <div
                                                    id="skills"
                                                    ref={skillsRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Fähigkeiten
                                                    </h1>

                                                    <p>
                                                        Fähigkeiten werden auf Projektebene definiert. Jedes Projekt ist
                                                        anders und besitzt daher seine eigenen benötigten Fähigkeiten. Um den Prozess
                                                        zu vereinfachen, kannst du Fähigkeiten aus anderen Projekten
                                                        importieren oder vorbereitete Vorlagen verwenden.
                                                        Beachte, dass nur der <b>Projektbesitzer</b> die verfügbaren
                                                        Fähigkeiten eines Projekts verwalten kann.
                                                    </p>

                                                    <GuideImg name="creating-skills.gif" isGerman={isGerman} />
                                                    <br />

                                                    <p>
                                                        Danach kannst du auswählen, welche dieser Fähigkeiten auf dich
                                                        zutreffen.
                                                    </p>

                                                    <GuideImg name="choosing-skills.gif" isGerman={isGerman} />
                                                    <br />

                                                    <p>
                                                        Zum Schluss kannst du auch festlegen, welche Fähigkeiten für eine
                                                        bestimmte Aufgabe erforderlich sind.
                                                    </p>

                                                    <GuideImg name="assigning-skills.gif" isGerman={isGerman} />
                                                </div>

                                                <div
                                                    id="workinghours"
                                                    ref={workinghoursRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Arbeitsstunden
                                                    </h1>

                                                    <p>
                                                        Genau wie Fähigkeiten sind auch Arbeitsstunden projektspezifisch.
                                                        Vielleicht arbeitest du gleichzeitig an mehreren Projekten und
                                                        investierst unterschiedlich viel Zeit in jedes davon.

                                                        Es gibt eine gemeinsame maximale Anzahl an Stunden pro Woche
                                                        (verwaltet vom Betreiber der STRIDE-Instanz), aber du kannst selbst
                                                        entscheiden, wie viele dieser Stunden auf welches Projekt entfallen.

                                                        Öffne dazu einfach die Projekteinstellungen und trage unter
                                                        „Meine Arbeitsstunden“ ein, wie viele Stunden pro Woche du für
                                                        dieses Projekt aufwenden möchtest.
                                                    </p>

                                                    <GuideImg name="choose-working-hours.gif" isGerman={isGerman} />
                                                    <br />

                                                    <p>
                                                        Gib anschließend eine Schätzung an, wie lange eine Aufgabe dauern
                                                        wird. Der Aufgaben-Scheduler überprüft dann, ob die Zuweisung dieser
                                                        Aufgabe deine verfügbare Arbeitszeit in einer bestimmten Woche
                                                        überschreiten würde.<br />

                                                        <i>
                                                            Hinweis: Es ist trotzdem möglich, Aufgaben zugewiesen zu
                                                            bekommen, die länger dauern als deine wöchentlichen
                                                            Arbeitsstunden. Der Scheduler versucht in diesem Fall automatisch,
                                                            einen passenden Zeitraum über mehrere Wochen hinweg zu finden.
                                                        </i>
                                                    </p>

                                                    <GuideImg name="choose-estimation.gif" isGerman={isGerman} />
                                                </div>

                                                <div
                                                    id="taskScheduler"
                                                    ref={taskSchedulerRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Scheduler ausführen
                                                    </h1>

                                                    <p>
                                                        Sobald alles eingerichtet ist, musst du nur noch den Scheduler
                                                        starten und dich entspannt zurücklehnen (für ungefähr zwei Sekunden),
                                                        während er die optimale Liste von Aufgabenzuweisungen berechnet.
                                                    </p>

                                                    <GuideImg name="scheduler-run.gif" isGerman={isGerman} />
                                                </div>
                                            </div>

                                            <div
                                                id="taskWhiteboardLinking"
                                                ref={taskWhiteboardLinkingRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Aufgaben mit dem Whiteboard verknüpfen
                                                </h1>

                                                <p>
                                                    Im letzten Abschnitt zeigen wir dir, wie du Brainstorming auf dem
                                                    Whiteboard mit den konkreten Aufgaben auf deinem Kanban-Board verbinden
                                                    kannst.

                                                    Es ist oft hilfreich, bestimmte Skizzen oder Designs auf dem Whiteboard
                                                    direkt mit den Aufgaben zu verknüpfen, die sie repräsentieren. Dadurch
                                                    behältst du leichter den Überblick über die einzelnen Komponenten eines
                                                    Projekts und deren Zusammenhänge.

                                                    Das Whiteboard liefert den Überblick über das große Ganze, während jede
                                                    Aufgabe einfach auf einen bestimmten Bereich des Whiteboards verweist und
                                                    sagt: „Das ist mein Teil.“
                                                </p>

                                                <br />

                                                <p>
                                                    Um einen Bereich des Whiteboards mit einer Aufgabe zu verknüpfen,
                                                    markierst du einfach alle relevanten Elemente, klickst oben rechts auf
                                                    „Aufgabe verknüpfen“ und wählst anschließend die gewünschte Aufgabe aus.
                                                </p>

                                                <GuideImg name="whiteboard-linking.gif" isGerman={isGerman} />
                                                <br />

                                                <p>
                                                    Die Verknüpfung wird durch ein normales Excalidraw-Rechteck mit einer
                                                    Überschrift dargestellt. Wenn du die Verknüpfung entfernen möchtest,
                                                    reicht es aus, dieses Excalidraw-Element zu löschen.

                                                    Beachte außerdem, dass der Aufgabentitel in der Überschrift angezeigt
                                                    wird. Änderst du den Titel der Aufgabe, wird die Überschrift automatisch
                                                    aktualisiert.
                                                </p>

                                                <br />

                                                <p>
                                                    Nach dem Verknüpfen kannst du entweder auf das Link-Symbol oben rechts
                                                    im Verknüpfungsrechteck klicken oder die gesamte Gruppe auswählen und
                                                    anschließend oben rechts „Aufgabe anzeigen“ wählen.

                                                    Die Aufgabe zeigt dann eine Vorschau des Whiteboards, die exakt auf den
                                                    ausgewählten Bereich skaliert und positioniert ist. Ein Klick auf die
                                                    Vorschau bringt dich direkt zurück zu dieser Stelle auf dem Whiteboard.
                                                </p>

                                                <GuideImg name="view-linked-task.gif" isGerman={isGerman} />
                                                <br />
                                            </div>
                                        </div>
                                    </section>
                                </main>
                            </div>
                        </Modal.Body>

                        <Modal.Footer className="justify-start">
                            <LanguageSwitcher />
                            <div className="bg-border h-5 w-px" />
                            <ThemeSwitcher />
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop >
        </Modal >
    );

    const englishVersion = (
        <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
            <Modal.Backdrop>
                <Modal.Container size="cover">
                    <Modal.Dialog>
                        <Modal.Header>The STRIDE Guide™</Modal.Header>

                        <Modal.Body>
                            <div className="flex h-full">
                                {/* Sidebar */}
                                <aside className="w-90 border-r p-2 flex flex-col gap-1">
                                    <AsideButton
                                        refObj={overviewRef}
                                        section="overview"
                                        text="Overview"
                                        activeSection={activeSection}
                                        scrollToSection={scrollToSection}
                                    />

                                    <AsideButton
                                        refObj={basicsRef}
                                        section="basics"
                                        text="Basics"
                                        activeSection={activeSection}
                                        scrollToSection={scrollToSection}
                                    />

                                    {/* Subsections */}
                                    <div className="ml-4 border-l pl-3 flex flex-col gap-1">

                                        <AsideButton
                                            refObj={profileRef}
                                            section="profile"
                                            text="Profile management"
                                            activeSection={activeSection}
                                            scrollToSection={scrollToSection}
                                        />

                                        <AsideButton
                                            refObj={projectRef}
                                            section="project"
                                            text="Creating and managing a project"
                                            activeSection={activeSection}
                                            scrollToSection={scrollToSection}
                                        />

                                        {/* Task group */}
                                        <div>
                                            <AsideButton
                                                refObj={taskRef}
                                                section="task"
                                                text="Task management"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />

                                            <div className="ml-4 border-l mt-1 flex flex-col gap-1">

                                                <AsideButton
                                                    refObj={createTaskRef}
                                                    section="createTask"
                                                    text="Creating and editing tasks"
                                                    activeSection={activeSection}
                                                    scrollToSection={scrollToSection}
                                                />

                                                <AsideButton
                                                    refObj={assignTaskRef}
                                                    section="assignTask"
                                                    text="Assigning tasks"
                                                    activeSection={activeSection}
                                                    scrollToSection={scrollToSection}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <AsideButton
                                                refObj={chatRef}
                                                section="chat"
                                                text="Chatting with others"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />
                                            <div className="ml-4 border-l mt-1 flex flex-col gap-1">
                                                <AsideButton
                                                    refObj={chatEverywhereRef}
                                                    section="chatEverywhere"
                                                    text="Chat everywhere"
                                                    activeSection={activeSection}
                                                    scrollToSection={scrollToSection}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <AsideButton
                                                refObj={whiteboardRef}
                                                section="whiteboard"
                                                text="Using the Whiteboard"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />
                                            <div className="ml-4 border-l mt-1 flex flex-col gap-1">
                                                <AsideButton
                                                    refObj={whiteboardTemplatesRef}
                                                    section="whiteboardTemplates"
                                                    text="Whiteboard Templates"
                                                    activeSection={activeSection}
                                                    scrollToSection={scrollToSection}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <AsideButton
                                        refObj={advancedRef}
                                        section="advanced"
                                        text="Advanced"
                                        activeSection={activeSection}
                                        scrollToSection={scrollToSection}
                                    />
                                    <div className="ml-4 border-l pl-3 flex flex-col gap-1">
                                        <AsideButton
                                            refObj={automaticTaskAssignmentRef}
                                            section="automaticTaskAssignment"
                                            text="Automatic Task Assignment"
                                            activeSection={activeSection}
                                            scrollToSection={scrollToSection}
                                        />
                                        <div className="ml-4 border-l mt-1 flex flex-col gap-1">
                                            <AsideButton
                                                refObj={skillsRef}
                                                section="skills"
                                                text="Skills"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />

                                            <AsideButton
                                                refObj={workinghoursRef}
                                                section="workinghours"
                                                text="Working-hours"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />

                                            <AsideButton
                                                refObj={taskSchedulerRef}
                                                section="taskScheduler"
                                                text="Running the Scheduler!"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />
                                        </div>
                                    </div>
                                    <div className="ml-4 border-l pl-3 flex flex-col gap-1">
                                        <AsideButton
                                            refObj={taskWhiteboardLinkingRef}
                                            section="taskWhiteboardLinking"
                                            text="Task-Whiteboard Linking"
                                            activeSection={activeSection}
                                            scrollToSection={scrollToSection}
                                        />
                                    </div>
                                </aside>

                                {/* Scrollable content */}
                                <main
                                    className="flex-1 overflow-y-auto p-6"
                                >
                                    <section className="mb-12">
                                        <div
                                            id="overview"
                                            ref={overviewRef}
                                            className="mb-16"
                                        >
                                            <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight">
                                                Overview
                                            </h1>
                                            <p>This little guide is designed to give you a full overview of <code>STRIDE</code>s' functionality. You can always open this page back up using the <CircleQuestionMark className="inline h-5 w-5" /> icon in the header.</p>
                                            <p className="mb-2">
                                                The guide will cover the following:
                                            </p>

                                            <ul className="list-disc pl-6 space-y-2">
                                                <li> Profile management </li>
                                                <li> Creating and managing a project </li>

                                                <li>
                                                    Task management
                                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                                        <li>Creating and editing tasks</li>
                                                        <li>Assigning tasks</li>
                                                    </ul>
                                                </li>
                                                <li>
                                                    Chatting with others
                                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                                        <li>Chat everywhere all the time</li>
                                                    </ul>
                                                </li>
                                                <li>
                                                    Using the Whiteboard
                                                </li>
                                            </ul>

                                            <p className="my-2">
                                                The big benefit of <code>STRIDE</code> is how all the different pages and functionalities are interconnected. However, this also requires a bit more knowledge over the app to really make use of those features (we recommend reading the above mentioned basics first before diving into the advanced topics). The following, more advanced section, covers the topics:
                                            </p>

                                            <ul className="list-disc pl-6 space-y-2">
                                                <li>
                                                    Skills
                                                    <ul className="list-disc pl-6 mt-2 space-y-1">
                                                        <li>Defining skills as a project owner</li>
                                                        <li>Assigning yourself skills</li>
                                                        <li>Assigning required task skills</li>
                                                    </ul>
                                                </li>

                                                <li>
                                                    Automatically assigning tasks
                                                </li>
                                                <li>
                                                    Linking your beautiful drawings to tasks
                                                </li>
                                            </ul>

                                        </div>
                                    </section>

                                    <section className="mb-12">
                                        <div
                                            id="basics"
                                            ref={basicsRef}
                                            className="mb-16"
                                        >
                                            <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight">
                                                Basics
                                            </h1>
                                            <div
                                                id="profile"
                                                ref={profileRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Profile Management
                                                </h1>
                                                <p>
                                                    In the top right corner you see a button with your name. When you click on it you can visit your profile. It should look something like this (ignore the profile photo!)
                                                </p>

                                                <GuideImg name='profile1.png' isGerman={isGerman} />
                                                <p>
                                                    The first two tabs are very standard, they simply let you change your name, password and e-mail address.
                                                    Do not worry about the skills and working-hours tabs yet, they are part of the advanced topics!
                                                </p>
                                            </div>
                                            <div
                                                id="project"
                                                ref={projectRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Creating and managing a project
                                                </h1>
                                                <p>
                                                    We will quickly create a new project, we will use this superb project as our reference-project for everything that follows! (Note: you can give it any name you want)
                                                </p>
                                                <GuideImg name='project-create.gif' isGerman={isGerman} />
                                                <br />
                                                <p>
                                                    Let's add some members, you can do that either directly from the "Add members" button, or in the project settings. Note that you can also remove them in the settings view (in case one is misbehaving).
                                                </p>
                                                <GuideImg name='project-addmembers.gif' isGerman={isGerman} />
                                                <br />
                                                <p>
                                                    Finally, when you are done with a project, you can either archive it to make it read-only, or your can properly delete it (but there is no coming back from that!). <br />

                                                    Archived projects also appear in a separate section, and you are always able to un-archive a project when you need to.
                                                </p>

                                                <GuideImg name="project-archive.gif" isGerman={isGerman} />

                                            </div>

                                            <div
                                                id="task"
                                                ref={taskRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Task management
                                                </h1>
                                                <p>
                                                    Now that your project is setup, it is time to add some tasks. Tasks allow you to define pieces of work that need to be accomplished during a specified timeframe. You'll later (in the advanced section) also see, how you can link tasks to the Whiteboard, and how to incorporate skill- and workload requirements into it. <br />

                                                    Note that there are two views: The Kanban-Board and a simple list. You are free to choose which one you want to use, one doesn't do anything more than the other. In this guide we will use the Kanban board.
                                                </p>

                                                <div
                                                    id="createTask"
                                                    ref={createTaskRef}
                                                    className="my-8 border-l pl-4"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">
                                                        Creating and editing tasks
                                                    </h1>
                                                    <p>
                                                        In order to create a task, simply go to the column of your choice (most likely "To Do") and put in a nice title to give a broad overview of the task. Once this is done, you can click on the task to give it a proper description, as well as how long you think the task is going to take and the timeframe in which you are allowed to work on it. <br />
                                                        <i>Note that all fields are completely optional. However, some fields should be filled out to incorporate them with the advanced features later.</i>
                                                    </p>

                                                    <GuideImg name="task-create-and-edit.gif" isGerman={isGerman} />
                                                </div>

                                                <div
                                                    id="assignTask"
                                                    ref={assignTaskRef}
                                                    className="my-8 border-l pl-4"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">
                                                        Assigning tasks
                                                    </h1>
                                                    <p>
                                                        You can assign any team member to any task, allowing you to manage who is responsible for which task. <i>We will later in the Advanced section see how this process can be automated and optimized!</i>
                                                    </p>

                                                    <GuideImg name="task-assign.gif" isGerman={isGerman} />
                                                </div>

                                            </div>

                                            <div
                                                id="chat"
                                                ref={chatRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Chatting with others
                                                </h1>

                                                <p>
                                                    The last page is the chat! The chat is very simple - you can write a message and edit it or delete it if you regret what you have written.
                                                </p>

                                                <GuideImg name="chat.gif" isGerman={isGerman} />

                                                <div
                                                    id="chatEverywhere"
                                                    ref={chatEverywhereRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Chat everywhere all the time
                                                    </h1>

                                                    <p>
                                                        You do not need to go to the dedicated chat-page to open the chat! You can also access it directly from the task or whiteboard page.
                                                    </p>

                                                    <GuideImg name="chat-everywhere-task.gif" isGerman={isGerman} />
                                                    <br />
                                                    <hr />
                                                    <br />
                                                    <GuideImg name="chat-everywhere-whiteboard.gif" isGerman={isGerman} />
                                                </div>
                                            </div>

                                            <div
                                                id="whiteboard"
                                                ref={whiteboardRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Using the Whiteboard
                                                </h1>

                                                <p>
                                                    The collaborative Whiteboard is a great option for things like brainstorming or designing more complex systems. For those unfamiliar with it, the Whiteboard is built on <a href="https://excalidraw.com/">Excalidraw</a>.
                                                </p>

                                                <GuideImg name="whiteboard.gif" isGerman={isGerman} />

                                                <div
                                                    id="whiteboardTemplates"
                                                    ref={whiteboardTemplatesRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Whiteboard Templates
                                                    </h1>

                                                    <p>
                                                        To get you started, we have designed a few templates that you can use. Templates are made up of plain-old Excalidraw drawings, so you can edit them all you like. You can, of course, use them as often as you want even in the same Whiteboard, they simply get added to your current position.
                                                    </p>

                                                    <GuideImg name="whiteboard-templates.gif" isGerman={isGerman} />
                                                </div>
                                            </div>


                                        </div>
                                    </section>

                                    <section id="settings" className="mb-12">
                                        <div
                                            id="advanced"
                                            ref={advancedRef}
                                            className="mb-16"
                                        >
                                            <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight">
                                                Advanced
                                            </h1>

                                            <div
                                                id="automaticTaskAssignment"
                                                ref={automaticTaskAssignmentRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Automatic Task Assignment
                                                </h1>

                                                <p>
                                                    As mentioned in "Assigning Tasks", you are able to fully automate this process and get a highly optimized list of assignments for your tasks. However, this is system is not magic and it is not just calling ChatGPT in the background. In order to make use of this system - the so-called Task-Scheduler (very creative naming) - you need to provide two new things we have not talked about yet: <b>Skills</b> and <b>Working Hours</b>
                                                </p>
                                                <br />

                                                <p>
                                                    In the subsections below we will show you how to create and use them, however, let's first explain what they are and how they affect the Task-Scheduler. <br /><b>Skills</b>: Let's say you are in a project that is working on a public website. Of course, somebody has to actually write the code for it. Another person is probably responsible for setting up and monitoring the server. And a third is doing all the marketing-related stuff. There are lots of tasks for this project, but it probably would not make any sense when our scheduler now assigns the "Big Marketing Campaign"-Task to the programmer, does it? Skills allow you to express this knowledge: The project owner can define multiple skills that are required for this project and tasks can then take a list of skills that are required to complete them. Finally, each user then needs to define what they are capable of by choosing skills from the project. Now, the scheduler will only provide an assignment for a user and a task if the user has all the required skills to complete the task! <br /><b>Working-Hours</b>: In order to properly balance the workload for each member, you are able to define how many hours per week you want to invest for any given project. For this to properly function, you also need to provide an estimation (in hours) of how long a task will take. When this is properly set-up, the scheduler will make sure not to overshoot your working-hours during any week!
                                                </p>

                                                <div
                                                    id="skills"
                                                    ref={skillsRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Skills
                                                    </h1>

                                                    <p>
                                                        Skills are defined at a project-level. Every project is unique and therefore every project defines which skills are included in it. In order to streamline this process, you can either import skills from a different project, or again use premade templates. Note that only the project <b>owner</b> is able to manage the skills available in a project!
                                                    </p>

                                                    <GuideImg name="creating-skills.gif" isGerman={isGerman} /><br />

                                                    <p>
                                                        Now you are able to define which of those skills apply to you!
                                                    </p>

                                                    <GuideImg name="choosing-skills.gif" isGerman={isGerman} /><br />

                                                    <p>
                                                        And finally, also assign which skills are required for any given task.
                                                    </p>

                                                    <GuideImg name="assigning-skills.gif" isGerman={isGerman} />
                                                </div>

                                                <div
                                                    id="workinghours"
                                                    ref={workinghoursRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Working Hours
                                                    </h1>

                                                    <p>
                                                        Again, as with skills, every project is unique and so is probably your involvement in it, especially when you are working on multiple projects at the same time! There is a shared maximum of hours-per-week you can spend (managed by the owner of the STRIDE instance), however, you are free to choose which project gets more or less of the whole. To do so, just go to the project settings and define the number of hours-per-week you want to work on this project under "My Working Hours".
                                                    </p>

                                                    <GuideImg name="choose-working-hours.gif" isGerman={isGerman} /><br />

                                                    <p>
                                                        Finally, provide an estimate of how long the task will take. The task scheduler will check if assigning you the task (assuming the estimated time) would overshoot your workload during any week. <i>Note: It is still possible to get tasks assigned that are longer than your weekly working-hours. The scheduler automatically tries to find a fitting range across multiple weeks if it needs to!</i>
                                                    </p>

                                                    <GuideImg name="choose-estimation.gif" isGerman={isGerman} />
                                                </div>

                                                <div
                                                    id="taskScheduler"
                                                    ref={taskSchedulerRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Running the Scheduler!
                                                    </h1>

                                                    <p>
                                                        Now that everything is setup, just run the scheduler and lay back (for like 2 seconds) until the scheduler found the optimal list of task-assignments!
                                                    </p>

                                                    <GuideImg name="scheduler-run.gif" isGerman={isGerman} />
                                                </div>
                                            </div>

                                            <div
                                                id="taskWhiteboardLinking"
                                                ref={taskWhiteboardLinkingRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Task-Whiteboard Linking
                                                </h1>

                                                <p>In this last section we will also show you how to combine the brainstorming inside your Whiteboard with more concretely written tasks in your Kanban-Board. Specifically, it would be nice if you can link the relevant parts of each of the sketches and designs you did in the Whiteboard with the individual Tasks that represent them. This makes it much easier to keep track of the individual components of a project and how they are interconnected. The Whiteboard can give a big-picture overview, and each task simply links to some region of the Whiteboard to say "This is my part".</p>
                                                <br />
                                                <p>In order to link a region of the Whiteboard with a task, simply select all the relevant elements, hit "Link Task" in the top-right corner and then choose the task you want to link.</p>

                                                <GuideImg name="whiteboard-linking.gif" isGerman={isGerman} /><br />

                                                <p>Notice that the link is simply represented by a normal Excalidraw rectangle and a header. Deleting the Link is as simple as deleting this Excalidraw element! Also notice that the Task title in the header: Changing the title automatically changes the header as well.</p><br />
                                                <p>Once linked, either click on the link icon in the top-right corner of the link-rectangle. Or click on the group in general and then click on "View Task" in the top right corner. The task will now show a preview of the Whiteboard, scaled and positioned exactly to the selected region. Clicking on the preview brings you right back to the selected spot on the Whiteboard.</p>

                                                <GuideImg name="view-linked-task.gif" isGerman={isGerman} /><br />
                                            </div>

                                        </div>
                                    </section>
                                </main>
                            </div>
                        </Modal.Body>

                        <Modal.Footer className="justify-start">
                            <LanguageSwitcher />
                            <div className="bg-border h-5 w-px" />
                            <ThemeSwitcher />
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop >
        </Modal >
    );

    if (isGerman) {
        return germanVersion;
    } else {
        return englishVersion;
    }
}

interface GuideImgProps {
    name: string;
    isGerman: boolean;
}

function GuideImg({ name, isGerman }: GuideImgProps) {
    return (
        <div className="flex justify-center">
            <img src={`/infoguide/${isGerman ? "de" : "en"}/${name}`} />
        </div>
    )
}

interface AsideButtonProps {
    refObj: RefObject<HTMLDivElement | null>;
    section: string;
    text: string;
    activeSection: string;
    scrollToSection: (ref: React.RefObject<HTMLDivElement | null>) => void;
};

function AsideButton({ refObj, section, text, activeSection, scrollToSection }: AsideButtonProps) {
    return (
        <Button
            variant='ghost'
            className={cn(
                "w-full justify-start px-3 py-2",
                activeSection === section && "bg-[var(--surface-secondary)] font-medium"
            )}
            onClick={() => scrollToSection(refObj)}
        >
            {text}
        </Button>
    )
}
