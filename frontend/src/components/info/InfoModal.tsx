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
    const { t, i18n } = useTranslation('common')
    const isGerman = i18n.language.startsWith("de");
    const location = useLocation();

    interface GuideImgProps {
        name: string;
    }

    function GuideImg({ name }: GuideImgProps) {
        return (
            <div className="flex justify-center">
                <img src={`/infoguide/${isGerman ? "de" : "en"}/${name}`} />
            </div>
        )
    }

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
    const taskWhiteboardLinking = useRef<HTMLDivElement>(null);

	const [activeSection, setActiveSection] = useState("overview");

    const pageToSection: Record<string, RefObject<HTMLDivElement | null>> = {
        "tasks": taskRef,
        "chat": chatRef,
        "whiteboard": whiteboardRef,
        "project": projectRef,
        "profile": profileRef,
    };

    interface AsideButtonProps {
        refObj: RefObject<HTMLDivElement | null>;
        section: string;
        text: string;
        activeSection: string;
        scrollToSection: (ref: React.RefObject<HTMLDivElement | null>) => void;
    };

    useEffect(() => {
        if (!isOpen) return;

		console.log(Object.keys(pageToSection), location.pathname);
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

    function AsideButton({ refObj, section, text, activeSection, scrollToSection }: AsideButtonProps) {
        return (
            <Button
                variant='ghost'
                className={cn(
                    "w-full justify-start px-3 py-2",
                    activeSection === section && "bg-default-200 font-medium"
                )}
                onClick={() => scrollToSection(refObj)}
            >
                {text}
            </Button>
        )
    }

    const scrollToSection = (
        ref: React.RefObject<HTMLDivElement | null>
    ) => {
        ref.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    };

    return (
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
                                                    section="chat-everywhere"
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
                                                    section="whiteboard-templates"
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
                                            section="automatic-task-assignment"
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
                                                section="working-hours"
                                                text="Working-hours"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />

                                            <AsideButton
                                                refObj={taskSchedulerRef}
                                                section="task-scheduler"
                                                text="Running the Scheduler!"
                                                activeSection={activeSection}
                                                scrollToSection={scrollToSection}
                                            />
                                        </div>
                                    </div>
                                    <div className="ml-4 border-l pl-3 flex flex-col gap-1">
                                        <AsideButton
                                            refObj={taskWhiteboardLinking}
                                            section="task-whiteboard-linking"
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
                                    <section id="overview" className="mb-12">
                                        <div
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
                                            ref={basicsRef}
                                            className="mb-16"
                                        >
                                            <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight">
                                                Basics
                                            </h1>
                                            <div
                                                ref={profileRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Profile Management
                                                </h1>
                                                <p>
                                                    In the top right corner you see a button with your name. When you click on it you can visit your profile. It should look something like this (ignore the profile photo!)
                                                </p>

                                                <GuideImg name='profile1.png' />
                                                <p>
                                                    The first two tabs are very standard, they simply let you change your name, password and e-mail address.
                                                    Do not worry about the skills and working-hours tabs yet, they are part of the advanced topics!
                                                </p>
                                            </div>
                                            <div
                                                ref={projectRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Creating and managing a project
                                                </h1>
                                                <p>
                                                    We will quickly create a new project, we will use this superb project as our reference-project for everything that follows! (Note: you can give it any name you want)
                                                </p>
                                                <GuideImg name='project-create.gif' />
                                                <br />
                                                <p>
                                                    Let's add some members, you can do that either directly from the "Add members" button, or in the project settings. Note that you can also remove them in the settings view (in case one is misbehaving).
                                                </p>
                                                <GuideImg name='project-addmembers.gif' />
                                                <br />
                                                <p>
                                                    Finally, when you are done with a project, you can either archive it to make it read-only, or your can properly delete it (but there is no coming back from that!). <br />

                                                    Archived projects also appear in a separate section, and you are always able to un-archive a project when you need to.
                                                </p>

                                                <GuideImg name="project-archive.gif" />

                                            </div>

                                            <div
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

                                                    <GuideImg name="task-create-and-edit.gif" />
                                                </div>

                                                <div
                                                    ref={assignTaskRef}
                                                    className="my-8 border-l pl-4"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-2xl font-bold tracking-tight">
                                                        Assigning tasks
                                                    </h1>
                                                    <p>
                                                        You can assign any team member to any task, allowing you to manage who is responsible for which task. <i>We will later in the Advanced section see how this process can be automated and optimized!</i>
                                                    </p>

                                                    <GuideImg name="task-assign.gif" />
                                                </div>

                                            </div>

                                            <div
                                                ref={chatRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Chatting with others
                                                </h1>

                                                <p>
                                                    The last page is the chat! The chat is very simple - you can write a message and edit it or delete it if you regret what you have written.
                                                </p>

                                                <GuideImg name="chat.gif" />

                                                <div
                                                    ref={chatEverywhereRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Chat everywhere all the time
                                                    </h1>

                                                    <p>
                                                        You do not need to go to the dedicated chat-page to open the chat! You can also access it directly from the task or whiteboard page.
                                                    </p>

                                                    <GuideImg name="chat-everywhere-task.gif" />
                                                    <br />
                                                    <hr />
                                                    <br />
                                                    <GuideImg name="chat-everywhere-whiteboard.gif" />
                                                </div>
                                            </div>

                                            <div
                                                ref={whiteboardRef}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Using the Whiteboard
                                                </h1>

                                                <p>
                                                    The collaborative Whiteboard is a great option for things like brainstorming or designing more complex systems. For those unfamiliar with it, the Whiteboard is built on <a href="https://excalidraw.com/">Excalidraw</a>.
                                                </p>

                                                <GuideImg name="whiteboard.gif" />

                                                <div
                                                    ref={whiteboardTemplatesRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Whiteboard Templates
                                                    </h1>

                                                    <p>
                                                        To get you started, we have designed a few templates that you can use. Templates are made up of plain-old Excalidraw drawings, so you can edit them all you like. You can, of course, use them as often as you want even in the same Whiteboard, they simply get added to your current position.
                                                    </p>

                                                    <GuideImg name="whiteboard-templates.gif" />
                                                </div>
                                            </div>


                                        </div>
                                    </section>

                                    <section id="settings" className="mb-12">
                                        <div
                                            ref={advancedRef}
                                            className="mb-16"
                                        >
                                            <h1 className="min-w-0 flex-1 truncate text-4xl font-bold tracking-tight">
                                                Advanced
                                            </h1>

                                            <div
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
                                                    ref={skillsRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Skills
                                                    </h1>

                                                    <p>
                                                        Skills are defined at a project-level. Every project is unique and therefore every project defines which skills are included in it. In order to streamline this process, you can either import skills from a different project, or again use premade templates. Note that only the project <b>owner</b> is able to manage the skills available in a project!
                                                    </p>

                                                    <GuideImg name="creating-skills.gif" /><br />

                                                    <p>
                                                        Now you are able to define which of those skills apply to you!
                                                    </p>

                                                    <GuideImg name="choosing-skills.gif" /><br />

                                                    <p>
                                                        And finally, also assign which skills are required for any given task.
                                                    </p>

                                                    <GuideImg name="assigning-skills.gif" />
                                                </div>

                                                <div
                                                    ref={workinghoursRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Working Hours
                                                    </h1>

                                                    <p>
                                                        Again, as with skills, every project is unique and so is probably your involvement in it, especially when you are working on multiple projects at the same time! There is a shared maximum of hours-per-week you can spend (managed by the owner of the STRIDE instance), however, you are free to choose which project gets more or less of the whole. To do so, just go to the project settings and define the number of hours-per-week you want to work on this project under "My Working Hours".
                                                    </p>

                                                    <GuideImg name="choose-working-hours.gif" /><br />

                                                    <p>
                                                        Finally, provide an estimate of how long the task will take. The task scheduler will check if assigning you the task (assuming the estimated time) would overshoot your workload during any week. <i>Note: It is still possible to get tasks assigned that are longer than your weekly working-hours. The scheduler automatically tries to find a fitting range across multiple weeks if it needs to!</i>
                                                    </p>

                                                    <GuideImg name="choose-estimation.gif" />
                                                </div>

                                                <div
                                                    ref={taskSchedulerRef}
                                                    className="my-8"
                                                >
                                                    <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                        Running the Scheduler!
                                                    </h1>

                                                    <p>
                                                        Now that everything is setup, just run the scheduler and lay back (for like 2 seconds) until the scheduler found the optimal list of task-assignments!
                                                    </p>

                                                    <GuideImg name="scheduler-run.gif" />
                                                </div>
                                            </div>

                                            <div
                                                ref={taskWhiteboardLinking}
                                                className="my-8"
                                            >
                                                <h1 className="min-w-0 flex-1 truncate text-3xl font-bold tracking-tight">
                                                    Task-Whiteboard Linking
                                                </h1>

                                                <p>In this last section we will also show you how to combine the brainstorming inside your Whiteboard with more formally written tasks in your Kanban-Board. Specifically, it would be nice if you can link the relevant parts of each of the sketches and designs you did in the Whiteboard with the individual Tasks that represent them. This makes it much easier to keep track of the individual components of a project and how they are interconnected. The Whiteboard can give a big-picture overview, and each task simply links to some region of the Whiteboard to say "This is my part".</p>
                                                <br />
                                                <p>In order to link a region of the Whiteboard with a task, simply select all the relevant elements, hit "Link Task" in the top-right corner and then choose the task you want to link.</p>

                                                <GuideImg name="whiteboard-linking.gif" /><br />

                                                <p>Notice that the link is simply represented by a normal Excalidraw rectangle and a header. Deleting the Link is as simple as deleting this Excalidraw element! Also notice that the Task title in the header: Changing the title automatically changes the header as well.</p><br />
                                                <p>Once linked, either click on the link icon in the top-right corner of the link-rectangle. Or click on the group in general and then click on "View Task" in the top right corner. The task will now show a preview of the Whiteboard, scaled and positioned exactly to the selected region. Clicking on the preview brings you right back to the selected spot on the Whiteboard.</p>

                                                <GuideImg name="view-linked-task.gif" /><br />
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
}
