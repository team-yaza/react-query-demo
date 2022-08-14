# Server State ❤️  Client State

## 개요 

> **이 글은 서버에서 데이터를 받아와 브라우저가 온라인, 오프라인 상태일 때 모두 데이터를 효과적으로 처리하기위해 생각한 방법에 대해 적은 글 입니다.(PWA)**

애플리케이션의 모든 것은 계속 변화할 수 있습니다. 
리액트에서는 상태를 지정하여 컴포넌트 수준에서 이러한 변경사항을 추적할 수 있습니다. 

`상태`란 주어진 시간에 대해 시스템을 나타내는 것으로 언제든지 변경될 수 있는 것입니다.

애플리케이션의 상태는 `Server State`와 `Client State`로 분류할 수 있습니다.

개발자는`서버의 상태`와 `클라이언트의 상태`를 명확하게 정의하고 관리해야합니다.

`서버의 상태`는 다음과 같은 특성을 지닙니다.



- 서버 상태는 사용자의 제어를 벗어난 위치에서 원격으로 유지된다.
- 비동기 요청을 통해 `fetching` 또는 `updating`이 가능하다.
- 소유권을 공유한다. 즉 사용자 모르게 다른 사용자가 변경할 수 있다.
- 시간이 지남에 따라 `stale` 또는 `outdated`된다. 



## 문제 정의

현재 진행하고 있는 프로젝트는 PWA 기반 프로젝트이고 오프라인 환경과 온라인 환경을 모두 처리할 수 있어야합니다. 


프로젝트의 상황을 간략하게 표현해 보겠습니다.

```js
const Home = () => {
  const { data: todos } = useTodoListQuery();

  return <TodoList todos={todos} />;
};

```

react-query를 사용해서 다음과 같이 메인 페이지에서 TodoList를 서버에서 불러옵니다. 즉 `CSR`입니다.

```js
const TodoList = ({ todos = [] }) => {
  return (
    <div>
      {todos.map((todo, index) => (
        <TodoListItem key={index} todo={todo} />
      ))}
    </div>
  );
};
```
`TodoList`는 그 데이터를 활용해서 `TodoListItem`에 내려줍니다.

```js
const TodoListItem = ({ todo }) => {
  const [title, setTitle] = useState(todo.title);
  const { mutate: updateTodo, isLoading } = useMutation(({ title }) => todoService.updateTodo({ title }), {
    onSuccess: () => {
      queryClient.invalidateQueries('todos');
    },
  });

  const onChange = (e) => {
    setTitle(e.target.value);
    updateTodo({title: e.target.value})
  };
  
  if (isLoading) {
  	return <div>로딩중</div>
  }

  return (
    <div>
      <input value={title} onChange={onChange} />
    </div>
  );
};
```

`TodoListItem`에서는 input에 값을 그대로 넣어주고 이 input값의 변화를 상태로 관리하기 위해 서버로 부터 받아온 상태를 클라이언트 컴포넌트의 상태로 관리하고 있습니다. 

만약 리덕스와 같은 상태관리 라이브러리를 쓴다면 아래와 같이 할 수 있습니다.

```js
const { data: todos } = useTodoListQuery()

useEffect(()=>{
  dispatch(storeTodo(todos))
}, [dispatch, todos])
```

이제 우리는 서버의 상태를 클라이언트 상태로 `둔갑`시켜서 관리하고 있는 상태가 됩니다.(서버 상태이기도 하고 클라이언트 상태이기도 합니다.)

이 `flow`를 다이어그램으로 그려보면 아래와 같습니다.

![](https://velog.velcdn.com/images/hyunjine/post/fe30c0f0-71ff-46c7-972f-6ae101fee0a5/image.png)


1. react-query가 데이터를 fetching하고 props로 내려주면서 하위 컴포넌트는 그 props를 상태로 갖는다.
2. 유저가 그 컴포넌트의 상태를 변경한다.
3. onChange 함수가 호출 될 때 서버에 알려주기 위해 mutate를 호출한다. 
`3-1`. onSuccess callback을 호출하여 데이터를 불러오는 쿼리를 무효화하고 데이터를 다시 가져온다.
`3-2`. onSuccess callback에서 아무것도 하지 않는다.(서버의 상태는 바뀌어도 refetch는 하지않는다.)

처음에 TodoList의 특성상 자신의 Todo는 다른사람에 의해 바뀌지 않는다고 생각해서 `3-2`의 방법을 선택하려고 했습니다.(리렌더링이 적습니다.) 

조금 더 생각해보면 PWA 기반 앱이기 때문에 사용자가 컴퓨터에서 로그인 할 수도 있고 모바일로 로그인할 수도 있습니다. 

로그인을 여러곳에서 했을 경우 자기 자신의 Todo 데이터라도 `stale`해질 수 있습니다. 

따라서 `3-1`의 방법을 채택하기로 했습니다. 

페이지가 새로고침된다면(온라인) 어짜피 react-query가 새로운 서버 상태를 가져오므로 문제없이 동작합니다. 



## 오프라인 환경

오프라인 환경을 처리해봅시다. 

우선 오프라인에서도 애플리케이션이 렌더링되기 위해서는 정적파일들을 캐싱해놓는것이 필요합니다. 또한 TodoList를 반환하는 쿼리도 캐싱이 필요합니다.

react-query에 `offlineFirst` 옵션을 부여해서 해결해보겠습니다. 

브라우저가 오프라인 상태라면 react-query의 요청이 서버에 전달되지 않습니다. 요청이 전달되지 않으면 react-query가 캐싱된 요청을 반환합니다. 

response header에 다음과 같이 적혀있습니다. 

```
cache-control: public, max-age=60, s-maxage=60
```
하지만 HTTP 캐시와 브라우저 캐시는 다릅니다. 
개발자가 HTTP 캐시를 조작할 수는 없겠죠.

따라서 캐싱된 요청을 사용해서 브라우저에 TodoList를 렌더링하는 것은 가능하나 개발자가 이 요청을 수정할 수는 없습니다. 

react-query의 신기했던 부분은 제가 오프라인에서 했던 요청들을 가지고 있다가 네트워크가 연결되는 순간 그 요청들을 보냈습니다.

이 기능만으로도 많은 기능을 개발할 수 있지만 오프라인에서 TodoList를 자유롭게 조작하려면 서버 상태와 의존하면 안됩니다.(오프라인)

온라인일 때 `서버상태`를 받아와 IndexedDB에 저장하고 `서버상태`를 `클라이언트 상태`로 바꿔놓은 후에 사용자가 입력을 하면서 `클라이언트 상태`를 변경하면 IndexedDB에 변경사항을 저장하면 됩니다. 

TodoList를 불러오는 네트워크 요청이 실패하면, 즉 오프라인이면 IndexedDB에서 데이터를 불러온 후에 유저가 `클라이언트 상태`를 자유롭게 조작하면서 데이터를 관리할 수 있습니다. 

원격 서버에 있는 데이터베이스가 아니고 브라우저의 IndexedDB와 통신을 하며 데이터를 CRUD하는 것이죠.

![](https://velog.velcdn.com/images/hyunjine/post/9fe67494-b406-499b-af32-0bcdb7f5cf01/image.png)

이제 사용자가 온라인 상태로 변경되었다면 `Worker`가 온라인 상태로 변경되었음을 감지해 IndexedDB와 Server DB를 동기화 시켜주면 됩니다. 


## 해결 방안

네트워크가 온라인인지 오프라인 상태인지 파악하기는 어렵습니다. 예를들어 와이파이가 연결되어있지만 인터넷은 연결안되는 것처럼 판단이 어려울 수 있습니다. 

**따라서 온라인과 오프라인에서 데이터를 가져오는 로직이 동일해야합니다.**

오프라인과 온라인 로직이 동일하려면 다음과 같은 요청 순서를 가져야합니다.

먼저 온라인 상황입니다.

![](https://velog.velcdn.com/images/hyunjine/post/9a344fc6-2266-445c-9263-ce0a1b1bfe48/image.png)


1. 첫째 네트워크 Todo를 가져오는 네트워크 요청을 보낸다.
2. 받아오면 IndexedDB에 우선 저장한다.
3. IndexedDB에서 데이터를 가져온다.

네트워크 요청을 IndexedDB에 먼저 저장하는 것이 의문일 수 있습니다. 하지만 오프라인 상황을 보시면 이해가 될 것 입니다. 

![](https://velog.velcdn.com/images/hyunjine/post/76dc449b-d307-4c14-b344-f40f2cc5cce7/image.png)


1. 네트워크 요청이 실패할 것이다.
2. IndexedDB에서 Todo를 가져온다. 

이렇게 하면 네트워크가 온라인인지 오프라인인지에 관계없이 같은 코드로 데이터를 효과적으로 처리할 수 있습니다. 


## 생각

다시 정리해보면 서버 상태를 클라이언트 상태로 바꾼다는 말은 사용자가 오프라인 환경이 되었을 때 애플리케이션의 상태를 서버 상태에 의존해서 조작하는 것이 아닌 클라이언트 상태 자체로 다루기 위한 것 입니다.(예: Todo를 추가할 때 요청을 서버에 보내는 것이 아닌 클라이언트 상태인 배열에 Todo를 추가하는 상황)

**서버상태와 클라이언트 상태가 의존관계를 갖는것이 좋지 않다고 생각하실 수 있습니다. 
하지만 오프라인 환경이라는 문제를 해결하기 위해 서버상태에서 클라이언트 상태로의 전환은 필수적이라고 생각합니다.**




## 참고

- [React Query as a State Manager](https://tkdodo.eu/blog/react-query-as-a-state-manager)
- [Offline React Query](https://tkdodo.eu/blog/offline-react-query)
- [What is the pattern to keep client-state in sync with server-state](https://github.com/TanStack/query/discussions/3539)
- [MOZI](https://github.com/team-yaza/mozi-client)

